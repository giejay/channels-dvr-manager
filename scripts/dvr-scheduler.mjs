#!/usr/bin/env node
import cron from 'node-cron';

const log = (message, details) => {
  const timestamp = new Date().toISOString();
  if (details === undefined) {
    console.log(`[dvr-scheduler] ${timestamp} ${message}`);
    return;
  }

  console.log(`[dvr-scheduler] ${timestamp} ${message}`, details);
};

const baseUrl = (process.env.CHANNELS_DVR_URL || process.env.API_PROXY_URL || 'http://www.channels.local').replace(/\/$/, '');
console.log(`Using base url: ${baseUrl}`);
const cronExpression = process.env.CHANNELS_DVR_CRON || '0 3 * * *';
const runImmediately = process.env.CHANNELS_DVR_RUN_IMMEDIATELY !== 'false';
const timeoutMs = Number(process.env.CHANNELS_DVR_TIMEOUT_MS || 30000);
console.log(`Using timeout: ${timeoutMs}ms`);
console.log(`Using cron expression: ${cronExpression}`);
console.log(`Run immediately: ${runImmediately}`);

const normalizeText = (value) => String(value ?? '').replace(/\s+/g, ' ').trim().toLowerCase();

const asArray = (value) => {
  if (Array.isArray(value)) return value;
  if (value === null || value === undefined) return [];
  return [value];
};

const getChannels = (entry) => {
  if (!entry) return [];
  if (Array.isArray(entry.Channels)) return entry.Channels.map((channel) => String(channel));
  if (entry.Channels) return asArray(entry.Channels).map((channel) => String(channel));
  if (entry.Channel) return [String(entry.Channel)];
  return [];
};

const getJobChannelList = (job) => {
  if (!job) return [];
  if (Array.isArray(job.Channels)) return job.Channels.map((channel) => String(channel));
  if (job.Channels) return asArray(job.Channels).map((channel) => String(channel));
  if (job.Channel) return [String(job.Channel)];
  if (job.Airing && job.Airing.Channels) return getChannels(job.Airing);
  return [];
};

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });

    const text = await response.text();
    const payload = text ? JSON.parse(text) : null;

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} from ${url}: ${text || response.statusText}`);
    }

    return payload;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutMs}ms for ${url}`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function extractList(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload) return [];
  if (Array.isArray(payload.Rules)) return payload.Rules;
  if (Array.isArray(payload.Jobs)) return payload.Jobs;
  if (Array.isArray(payload.Items)) return payload.Items;
  return [];
}

function hasMatchingSchedule(existingJobs, airing, rule) {
  const candidateName = normalizeText(airing?.Title || rule?.Name || '');
  const candidateTime = Number(airing?.Time ?? 0);
  const candidateChannels = getChannels(airing);

  return existingJobs.some((job) => {
    const jobName = normalizeText(job?.Name || job?.Airing?.Title || '');
    const jobTime = Number(job?.Time ?? job?.Airing?.Time ?? 0);
    const jobChannels = getJobChannelList(job);

    const sameName = candidateName && jobName && candidateName === jobName;
    const sameTime = candidateTime > 0 && jobTime > 0 && candidateTime === jobTime;

    if (!sameName || !sameTime) {
      return false;
    }

    if (candidateChannels.length === 0 || jobChannels.length === 0) {
      return true;
    }

    return candidateChannels.some((channel) => jobChannels.includes(String(channel)));
  });
}

function buildJobPayload(rule, airing) {
  const channels = getChannels(airing);
  const durationFromRule = Number(rule?.PaddingStart || 0) + Number(rule?.PaddingEnd || 0);
  const rawDuration = Number(airing?.Duration || 0);
  const actualDuration = rawDuration > 0 ? rawDuration + durationFromRule : durationFromRule || 1800;

  return {
    Name: airing?.Title || rule?.Name || 'Recording',
    Time: Number(airing?.Time || 0),
    Duration: actualDuration,
    Channels: channels.length ? channels : (rule?.EQ?.Channel ? [String(rule.EQ.Channel)] : []),
    Airing: airing,
    RuleID: rule?.ID || null,
    RuleName: rule?.Name || null,
  };
}

async function fetchRules() {
  const rulesResponse = await fetchJson(`${baseUrl}/dvr/rules`);
  return extractList(rulesResponse);
}

async function fetchJobs() {
  const endpoints = [`${baseUrl}/dvr/jobs?all=true`, `${baseUrl}/dvr/jobs`];

  for (const endpoint of endpoints) {
    try {
      const jobsResponse = await fetchJson(endpoint);
      const jobs = extractList(jobsResponse);
      log(`retrieved scheduled jobs from ${endpoint}`, { count: jobs.length });
      return jobs;
    } catch (error) {
      log(`failed to fetch scheduled jobs from ${endpoint}`, { error: error.message });
    }
  }

  log('unable to fetch scheduled jobs from either jobs endpoint');
  return [];
}

async function testRuleMatches(rule) {
  const response = await fetchJson(`${baseUrl}/dvr/rules/test`, {
    method: 'POST',
    body: JSON.stringify(rule),
  });
  return extractList(response);
}

async function addMatchedRecording(rule, airing, existingJobs) {
  if (hasMatchingSchedule(existingJobs, airing, rule)) {
    log(`already scheduled: ${airing?.Title || rule?.Name} @ ${airing?.Time} on ${getChannels(airing).join(', ') || 'unknown channel'}`);
    return false;
  }

  const payload = buildJobPayload(rule, airing);
  log(`creating recording: ${payload.Name} @ ${payload.Time} duration=${payload.Duration}s channels=${payload.Channels.join(', ') || 'unknown'}`);

  const response = await fetchJson(`${baseUrl}/dvr/jobs/new`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  log(`recording created for ${payload.Name}`, { response });
  return true;
}

async function scanRules() {
  log(`starting DVR rule scan for ${baseUrl}`);

  const rules = await fetchRules();
  if (!rules.length) {
    log('no DVR rules returned from the API');
    return;
  }

  const jobs = await fetchJobs();
  let totalMatches = 0;
  let totalCreated = 0;
  let totalSkipped = 0;

  for (const rule of rules) {
    if (rule?.Paused) {
      log(`skipping paused rule "${rule.Name || rule.ID}"`);
      continue;
    }

    log(`testing rule "${rule.Name || rule.ID}" (${rule.ID})`);

    let matches;
    try {
      matches = await testRuleMatches(rule);
    } catch (error) {
      log(`rule test failed for "${rule.Name || rule.ID}"`, { error: error.message });
      continue;
    }

    const programs = Array.isArray(matches) ? matches : [];
    log(`rule "${rule.Name || rule.ID}" matched ${programs.length} guide program(s)`);

    if (!programs.length) {
      continue;
    }

    totalMatches += programs.length;

    for (const airing of programs) {
      log(`program match: title="${airing?.Title || 'unknown'}" time=${airing?.Time} channel=${getChannels(airing).join(', ') || 'unknown'} duration=${airing?.Duration || 0}`);

      const scheduled = await addMatchedRecording(rule, airing, jobs);
      if (scheduled) {
        totalCreated += 1;
      } else {
        totalSkipped += 1;
      }
    }
  }

  log(`DVR rule scan complete: ${totalMatches} matches found, ${totalCreated} created, ${totalSkipped} already scheduled`);
}

async function main() {
  log(`DVR scheduler is active. Cron: ${cronExpression}. Base URL: ${baseUrl}`);

  if (runImmediately) {
    log('running initial scan immediately on startup');
    try {
      await scanRules();
    } catch (error) {
      log('initial scan failed', { error: error.message });
    }
  }

  cron.schedule(cronExpression, async () => {
    log(`cron tick triggered for ${cronExpression}`);
    try {
      await scanRules();
    } catch (error) {
      log('scheduled scan failed', { error: error.message });
    }
  }, { timezone: process.env.TZ || 'UTC' });

  log('scheduler ready; waiting for cron triggers');
}

main().catch((error) => {
  log('scheduler exited with an unrecoverable error', { error: error.message });
  process.exitCode = 1;
});
