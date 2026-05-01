<template>
  <section class="manual-recording-section">
    <form @submit.prevent="submitRecording" class="manual-form">
      <!-- Title -->
      <div class="form-row">
        <label for="title">Title</label>
        <input id="title" v-model="title" required />
      </div>

      <!-- Start Date & Time -->
      <div class="form-row">
        <label for="start">Start Date & Time</label>
        <input id="start" type="datetime-local" v-model="start" required />
      </div>

      <!-- End Date & Time -->
      <div class="form-row">
        <label for="end">End Date & Time</label>
        <input id="end" type="datetime-local" v-model="end" required />
      </div>

      <!-- Max Duration -->
      <div class="form-row">
        <label for="maxDurationH">Max Duration (split recordings)</label>
        <div class="duration-group">
          <input id="maxDurationH" type="number" v-model.number="maxDurationH" min="0" max="23" placeholder="00" />
          <span>:</span>
          <input id="maxDurationM" type="number" v-model.number="maxDurationM" min="0" max="59" placeholder="00" />
          <span>(leave as 00:00 for no split)</span>
        </div>
      </div>

      <!-- Repeat Days -->
      <div class="form-row">
        <label for="repeatDays">Repeat (days)</label>
        <input id="repeatDays" type="number" v-model.number="repeatDays" min="1" max="365" />
      </div>

      <!-- Channels -->
      <div class="form-row">
        <label>Select Channels</label>
        <div class="channel-search-wrapper">
          <input v-model="channelSearch" placeholder="Search channels..." />
          <ul v-if="filteredChannels.length" class="channel-list">
            <li v-for="ch in filteredChannels" :key="ch.ID">
              <label style="display:flex;align-items:center;cursor:pointer;width:100%;gap:0.5rem;margin:0;font-weight:normal;">
                <input type="checkbox" :value="ch" v-model="selectedChannels" @change="onChannelSelect(ch)" />
                <img :src="ch.Logo" :alt="ch.GuideName" />
                <span>{{ ch.GuideNumber }} - {{ ch.GuideName }}</span>
              </label>
            </li>
          </ul>
        </div>
      </div>

      <!-- Selected Channels Display -->
      <div v-if="selectedChannels.length" class="form-row">
        <label></label>
        <div class="selected-channels">
          <div class="selected-channels-label">{{ selectedChannels.length }} channel(s) selected</div>
          <div v-for="ch in selectedChannels" :key="ch.ID" class="selected-channel-item">
            <span>{{ ch.GuideNumber }} - {{ ch.GuideName }}</span>
            <button type="button" @click="removeChannel(ch)">×</button>
          </div>
        </div>
      </div>

      <!-- Summary -->
      <div class="form-row">
        <label for="summary">Summary</label>
        <input id="summary" v-model="summary" />
      </div>

      <!-- Recording Summary -->
      <div v-if="(splitCount > 1 || repeatDays > 1) && selectedChannels.length >= 1 && segmentSummariesDisplay.length" class="form-row">
        <label></label>
        <div class="form-hint">
          <div>Will create {{ segmentSummaries.length * selectedChannels.length }} recording(s):</div>
          <ul>
            <li v-for="(seg, idx) in segmentSummariesDisplay" :key="idx">
              {{ seg }}
            </li>
          </ul>
        </div>
      </div>

      <!-- Image Search -->
      <div class="form-row">
        <label for="imageSearch">Search Image</label>
        <div class="image-search-wrapper">
          <input id="imageSearch" v-model="imageSearch" @input="searchImages" placeholder="Search for an image..." />
          <ul v-if="imageResults.length" class="image-list">
            <li v-for="(img, idx) in imageResults" :key="idx" @click="selectImage(img)">
              <img :src="img" :alt="`Result ${idx+1}`" />
            </li>
          </ul>
        </div>
      </div>

      <!-- Selected Image Display -->
      <div v-if="selectedImage" class="form-row">
        <label></label>
        <div class="selected-image-container">
          <img :src="selectedImage" :alt="'Selected'" />
        </div>
      </div>

      <!-- Submit Button -->
      <div class="form-row">
        <label></label>
        <button type="submit">Create Recording</button>
      </div>

      <!-- Messages -->
      <div v-if="error" style="color:red">{{ error }}</div>
      <div v-if="success" style="color:green">Recording created successfully!</div>
    </form>
  </section>
</template>

<script setup>
import { ref, computed, onMounted, defineEmits, watch, defineProps } from 'vue'

const emit = defineEmits()
// Add a prop for dialog visibility
const props = defineProps({
  visible: Boolean
})

const now = new Date();
const pad = n => n.toString().padStart(2, '0');
const todayStr = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
const title = ref('')
const start = ref(todayStr)
const end = ref(todayStr)
const maxDurationH = ref(0)
const maxDurationM = ref(0)
const repeatDays = ref(1)
const channelSearch = ref('')
const summary = ref('')
const error = ref('')
const success = ref(false)
const channels = ref([])
const selectedChannels = ref([])
const imageSearch = ref('')
const imageResults = ref([])
const selectedImage = ref('')

// Remove hardcoded Unsplash API key and use environment variable
const UNSPLASH_CLIENT_ID = import.meta.env.VITE_UNSPLASH_CLIENT_ID

onMounted(async () => {
  try {
    const res = await fetch('/api/devices')
    channels.value = (await res.json()).flatMap(dev => dev.Channels)
  } catch (e) {
    error.value = 'Failed to fetch channels.'
  }
})

const filteredChannels = computed(() => {
  if (!channelSearch.value) return []
  return channels.value.filter(ch =>
    ch.GuideName.toLowerCase().includes(channelSearch.value.toLowerCase()) ||
    ch.GuideNumber.includes(channelSearch.value)
  )
})

function onChannelSelect(ch) {
  channelSearch.value = ''
}

function removeChannel(ch) {
  selectedChannels.value = selectedChannels.value.filter(c => c.ID !== ch.ID)
}

const splitCount = computed(() => {
  if (!start.value || !end.value) return 0
  const startEpoch = new Date(start.value).getTime()
  const endEpoch = new Date(end.value).getTime()
  if (endEpoch <= startEpoch) return 0
  const maxDur = maxDurationH.value * 3600 + maxDurationM.value * 60
  if (!maxDur) return 1
  const total = Math.floor((endEpoch - startEpoch) / 1000)
  return Math.ceil(total / maxDur)
})

const segmentSummaries = computed(() => {
  if (!start.value || !end.value || repeatDays.value < 1) return []
  const startEpoch = new Date(start.value).getTime()
  const endEpoch = new Date(end.value).getTime()
  if (endEpoch <= startEpoch) return []
  const maxDur = maxDurationH.value * 3600 + maxDurationM.value * 60
  let arr = []
  for (let d = 0; d < repeatDays.value; d++) {
    let segStart = Math.floor(startEpoch / 1000) + d * 24 * 3600
    let segEnd = Math.floor(endEpoch / 1000) + d * 24 * 3600
    if (!maxDur || maxDur >= (segEnd - segStart)) {
      arr.push({
        start: new Date(segStart * 1000),
        end: new Date(segEnd * 1000),
        duration: `${Math.floor((segEnd - segStart) / 3600)}h ${Math.floor(((segEnd - segStart) % 3600) / 60)}m`
      })
    } else {
      let cur = segStart
      while (cur < segEnd) {
        let next = Math.min(cur + maxDur, segEnd)
        arr.push({
          start: new Date(cur * 1000),
          end: new Date(next * 1000),
          duration: `${Math.floor((next - cur) / 3600)}h ${Math.floor(((next - cur) % 3600) / 60)}m`
        })
        cur = next
      }
    }
  }
  return arr
})

const segmentSummariesDisplay = computed(() => {
  if (!segmentSummaries.value.length) return []
  const channelNames = selectedChannels.value.map(ch => ch.GuideName).join(', ')
  return segmentSummaries.value.map(seg => {
    const startStr = seg.start.toLocaleString('en-GB', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
    const endStr = seg.end.toLocaleString('en-GB', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
    return `${startStr} - ${endStr} (${seg.duration})${channelNames ? ' for: ' + channelNames : ''}`
  })
})

async function searchImages() {
  imageResults.value = []
  if (!imageSearch.value) return
  const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(imageSearch.value)}&client_id=${UNSPLASH_CLIENT_ID}&per_page=8`
  try {
    const res = await fetch(url)
    if (res.ok) {
      const data = await res.json()
      imageResults.value = (data.results || []).map(item => item.urls.small)
    }
  } catch (e) {
    // fallback or error handling
  }
}

function selectImage(url) {
  selectedImage.value = url
  imageResults.value = []
}

function resetForm() {
  title.value = ''
  start.value = todayStr
  end.value = todayStr
  maxDurationH.value = 0
  maxDurationM.value = 0
  repeatDays.value = 1
  channelSearch.value = ''
  summary.value = ''
  error.value = ''
  success.value = false
  selectedChannels.value = []
  imageSearch.value = ''
  imageResults.value = []
  selectedImage.value = ''
}

// Watch for dialog close to reset form
watch(() => props.visible, (val) => {
  if (!val) {
    resetForm()
  }
})

async function submitRecording() {
  error.value = ''
  success.value = false
  if (!selectedChannels.value.length) {
    error.value = 'Select at least one channel.'
    return
  }
  if (!start.value || !end.value) {
    error.value = 'Start and end time required.'
    return
  }
  const startEpoch = Math.floor(new Date(start.value).getTime() / 1000)
  const endEpoch = Math.floor(new Date(end.value).getTime() / 1000)
  if (endEpoch <= startEpoch) {
    error.value = 'End must be after start.'
    return
  }
  const maxDur = maxDurationH.value * 3600 + maxDurationM.value * 60
  let jobs = []
  for (let d = 0; d < repeatDays.value; d++) {
    let segStart = startEpoch + d * 24 * 3600
    let segEnd = endEpoch + d * 24 * 3600
    if (!maxDur || maxDur >= (segEnd - segStart)) {
      // One job for the whole range
      const segTitle = `${title.value} (${pad(new Date(segStart * 1000).getHours())}:${pad(new Date(segStart * 1000).getMinutes())}-${pad(new Date(segEnd * 1000).getHours())}:${pad(new Date(segEnd * 1000).getMinutes())})`
      for (const ch of selectedChannels.value) {
        jobs.push({
          Name: segTitle,
          Time: segStart,
          Duration: segEnd - segStart,
          Channels: [ch.GuideNumber],
          Airing: {
            Source: 'manual',
            Channel: ch.GuideNumber,
            Time: segStart,
            Duration: segEnd - segStart,
            Title: segTitle,
            Summary: summary.value,
            SeriesID: `manual/${ch.GuideNumber}`,
            Image: selectedImage.value || undefined
          }
        })
      }
    } else {
      let cur = segStart
      while (cur < segEnd) {
        let next = Math.min(cur + maxDur, segEnd)
        const segTitle = `${title.value} (${pad(new Date(cur * 1000).getHours())}:${pad(new Date(cur * 1000).getMinutes())}-${pad(new Date(next * 1000).getHours())}:${pad(new Date(next * 1000).getMinutes())})`
        for (const ch of selectedChannels.value) {
          jobs.push({
            Name: segTitle,
            Time: cur,
            Duration: next - cur,
            Channels: [ch.GuideNumber],
            Airing: {
              Source: 'manual',
              Channel: ch.GuideNumber,
              Time: cur,
              Duration: next - cur,
              Title: segTitle,
              Summary: summary.value,
              SeriesID: `manual/${ch.GuideNumber}`,
              Image: selectedImage.value || undefined
            }
          })
        }
        cur = next
      }
    }
  }
  try {
    for (const job of jobs) {
      const res = await fetch('/api/dvr/jobs/new', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(job)
      })
      if (!res.ok) throw new Error('Failed to create recording')
    }
    success.value = true
    emit('recording-created')
  } catch (e) {
    error.value = 'Failed to create recording.'
  }
}
</script>

<style scoped>
.manual-recording-section {
  width: 100%;
}

.manual-form {
  display: grid;
  gap: 1.5rem;
  background: var(--color-background, #fff);
  color: var(--color-text, #222);
}

/* Mobile: single column layout */
.form-row {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

label {
  font-weight: 600;
  font-size: 0.95rem;
  color: var(--color-text, #222);
}

input[type="text"],
input[type="number"],
input[type="datetime-local"] {
  width: 100%;
  box-sizing: border-box;
  padding: 0.75rem;
  border-radius: 0.375rem;
  border: 1px solid var(--color-background-soft, #ddd);
  background: var(--color-background-mute, #f5f5f5);
  color: var(--color-text, #222);
  font-size: 1rem;
}

input[type="text"]:focus,
input[type="number"]:focus,
input[type="datetime-local"]:focus {
  outline: none;
  border-color: #409eff;
  box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.2);
}

button[type="submit"] {
  padding: 0.75rem 1.5rem;
  border-radius: 0.375rem;
  background: #409eff;
  color: white !important;
  border: none;
  cursor: pointer;
  font-weight: 600;
  font-size: 1rem;
  transition: background 0.2s;
}

button[type="submit"]:hover {
  background: #66b1ff;
}

button[type="submit"]:active {
  background: #3375dd;
}

/* Duration input group */
.duration-group {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  flex-wrap: wrap;
}

.duration-group input {
  width: 80px;
  text-align: center;
}

.duration-group span {
  color: var(--color-text-secondary, #aaa);
  font-size: 0.9rem;
}

/* Channel search and selection */
.channel-search-wrapper {
  position: relative;
}

.channel-list {
  list-style: none;
  padding: 0;
  margin: 0;
  background: var(--color-background-mute, #232323);
  border: 1px solid var(--color-background-soft, #ddd);
  max-height: 240px;
  overflow-y: auto;
  position: absolute;
  z-index: 10;
  width: 100%;
  color: var(--color-text, #fff);
  border-radius: 0.375rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  top: 100%;
  margin-top: 0.25rem;
}

.channel-list li {
  cursor: pointer;
  padding: 0.75rem;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: transparent;
  color: var(--color-text, #fff);
  border-bottom: 1px solid var(--color-background-soft, #ddd);
  transition: background 0.15s;
}

.channel-list li:last-child {
  border-bottom: none;
}

.channel-list li:hover {
  background: var(--color-background-soft, #333);
}

.channel-list img {
  width: 32px;
  height: 32px;
  border-radius: 0.25rem;
  flex-shrink: 0;
}

/* Selected channels display */
.selected-channels {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.75rem;
  background: var(--color-background-mute);
  border-radius: 0.375rem;
  border: 1px solid var(--color-background-soft);
}

.selected-channels-label {
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--color-text);
}

.selected-channel-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem;
  background: var(--color-background-soft);
  border-radius: 0.25rem;
  font-size: 0.95rem;
}

.selected-channel-item button {
  background: none;
  border: none;
  color: #f56c6c;
  cursor: pointer;
  font-size: 1.2rem;
  padding: 0;
  line-height: 1;
}

.selected-channel-item button:hover {
  color: #dd001b;
}

/* Image search and results */
.image-search-wrapper {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  position: relative;
}

.image-list {
  list-style: none;
  padding: 0.5rem;
  margin: 0;
  background: var(--color-background-mute, #232323);
  border: 1px solid var(--color-background-soft, #ddd);
  max-height: 200px;
  overflow-y: auto;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(60px, 1fr));
  gap: 0.5rem;
  border-radius: 0.375rem;
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  z-index: 10;
}

.image-list li {
  cursor: pointer;
  overflow: hidden;
  border-radius: 0.25rem;
  transition: transform 0.15s;
}

.image-list li:hover {
  transform: scale(1.05);
}

.image-list img {
  width: 100%;
  height: 60px;
  object-fit: cover;
}

.selected-image-container {
  padding: 0.75rem;
  background: var(--color-background-mute);
  border-radius: 0.375rem;
  text-align: center;
}

.selected-image-container img {
  max-width: 150px;
  height: auto;
  border-radius: 0.375rem;
}

/* Form hint/summary */
.form-hint {
  padding: 1rem;
  background: var(--color-background-mute);
  border-left: 3px solid #409eff;
  border-radius: 0.375rem;
  color: var(--color-text);
  font-size: 0.95rem;
}

.form-hint div {
  font-weight: 600;
  margin-bottom: 0.5rem;
}

.form-hint ul {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.form-hint li {
  padding: 0.25rem 0;
  color: var(--color-text-secondary, #aaa);
  font-size: 0.9rem;
  word-break: break-word;
}

/* Error and success messages */
[style*="color:red"] {
  color: #f56c6c !important;
  padding: 0.75rem;
  background: rgba(245, 108, 108, 0.1);
  border-radius: 0.375rem;
  border-left: 3px solid #f56c6c;
}

[style*="color:green"] {
  color: #67c23a !important;
  padding: 0.75rem;
  background: rgba(103, 194, 58, 0.1);
  border-radius: 0.375rem;
  border-left: 3px solid #67c23a;
}

/* Dialog Styling */
:deep(.el-dialog) {
  --el-dialog-bg-color: var(--color-background);
  background: var(--color-background) !important;
}

:deep(.el-dialog__header) {
  background: var(--color-background) !important;
  border-bottom: 1px solid var(--color-background-soft);
}

:deep(.el-dialog__title) {
  color: var(--color-text) !important;
}

:deep(.el-dialog__close) {
  color: var(--color-text) !important;
}

:deep(.el-dialog__body) {
  background: var(--color-background) !important;
  color: var(--color-text) !important;
}

:deep(.el-dialog__footer) {
  background: var(--color-background) !important;
  border-top: 1px solid var(--color-background-soft);
}

/* Ensure submit button in dialog always has white text */
:deep(.el-dialog__footer button[type="submit"]) {
  color: white !important;
}

/* Tablet and larger: Use grid layout */
@media (min-width: 768px) {
  .manual-form {
    grid-template-columns: 140px 1fr;
    gap: 1rem;
    align-items: start;
  }

  .form-row {
    display: contents;
  }

  .form-row label {
    text-align: right;
    align-self: center;
    padding-right: 0;
    font-weight: 600;
  }

  .channel-list {
    width: 100%;
    min-width: 320px;
  }

  .image-list {
    width: 100%;
    min-width: 320px;
  }
}

/* Desktop: wider form */
@media (min-width: 1024px) {
  .manual-form {
    max-width: 600px;
  }
}
</style>
