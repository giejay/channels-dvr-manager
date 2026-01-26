<template>
  <section>
    <form @submit.prevent="submitRecording" class="manual-form">
      <div class="form-row">
        <label for="title">Title:</label>
        <input id="title" v-model="title" required />
      </div>
      <div class="form-row">
        <label for="start">Start Date & Time:</label>
        <input id="start" type="datetime-local" v-model="start" required />
      </div>
      <div class="form-row">
        <label for="end">End Date & Time:</label>
        <input id="end" type="datetime-local" v-model="end" required />
      </div>
      <div class="form-row">
        <label for="maxDuration">Max Duration:</label>
        <div style="display:flex;gap:8px;align-items:center">
          <input id="maxDurationH" type="number" v-model.number="maxDurationH" min="0" max="23" style="width:60px" placeholder="hh" />
          <span>:</span>
          <input id="maxDurationM" type="number" v-model.number="maxDurationM" min="0" max="59" style="width:60px" placeholder="mm" />
          <span style="font-size:0.95em;color:var(--color-text-secondary,#aaa)">(00:00 = no split)</span>
        </div>
      </div>
      <div class="form-row">
        <label for="repeatDays">Repeat (days):</label>
        <input id="repeatDays" type="number" v-model.number="repeatDays" min="1" max="365" style="width:80px" />
      </div>
      <div class="form-row">
        <label>Channels:</label>
        <div style="flex:1; position:relative">
          <input v-model="channelSearch" placeholder="Search channel..." />
          <ul v-if="filteredChannels.length" class="channel-list">
            <li v-for="ch in filteredChannels" :key="ch.ID">
              <label style="display:flex;align-items:center;cursor:pointer;">
                <input type="checkbox" :value="ch" style="margin-right: 5px" v-model="selectedChannels" @change="onChannelSelect(ch)" />
                <img :src="ch.Logo" :alt="ch.GuideName" width="32" height="32" />
                {{ ch.GuideNumber }} - {{ ch.GuideName }}
              </label>
            </li>
          </ul>
        </div>
      </div>
      <div v-if="selectedChannels.length" class="form-row">
        <label></label>
        <div>
          <strong>Selected:</strong>
          <div v-for="ch in selectedChannels" :key="ch.ID" style="margin-bottom:4px;">
            {{ ch.GuideNumber }} - {{ ch.GuideName }}
            <button type="button" @click="removeChannel(ch)" style="margin-left:2px;">&times;</button>
          </div>
        </div>
      </div>
      <div class="form-row">
        <label>Summary:</label>
        <input v-model="summary" />
      </div>
      <div v-if="(splitCount > 1 || repeatDays > 1) && selectedChannels.length >=  1 && segmentSummariesDisplay.length" class="form-row">
        <label></label>
        <div class="form-hint">
          <div>Will create {{ segmentSummaries.length * selectedChannels.length }} recordings:</div>
          <ul>
            <li v-for="(seg, idx) in segmentSummariesDisplay" :key="idx">
              {{ seg }}
            </li>
          </ul>
        </div>
      </div>
      <div class="form-row">
        <label>Image:</label>
        <div style="flex:1">
          <input v-model="imageSearch" @input="searchImages" placeholder="Search image..." />
          <ul v-if="imageResults.length" class="image-list">
            <li v-for="(img, idx) in imageResults" :key="idx" @click="selectImage(img)">
              <img :src="img" :alt="`Image result ${idx+1}`" width="50" height="50" />
            </li>
          </ul>
        </div>
      </div>
      <div v-if="selectedImage" class="form-row">
        <label></label>
        <div><img :src="selectedImage" :alt="'Selected image'" width="100" /></div>
      </div>
      <div class="form-row">
        <label></label>
        <button type="submit">Create Recording</button>
      </div>
      <div v-if="error" style="color:red">{{ error }}</div>
      <div v-if="success" style="color:green">Recording created!</div>
    </form>
  </section>
</template>

<script setup>
import { ref, computed, onMounted, defineEmits, watch } from 'vue'

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
.manual-form {
  display: grid;
  grid-template-columns: 160px 1fr;
  gap: 12px 16px;
  max-width: 500px;
  margin: 0 auto;
  background: var(--color-background, #fff);
  color: var(--color-text, #222);
  padding: 24px 18px;
}
.form-row {
  display: contents;
}
label {
  text-align: right;
  align-self: center;
  font-weight: 500;
  padding-right: 8px;
  color: var(--color-text, #222);
}
input[type="text"],
input[type="number"],
input[type="datetime-local"] {
  width: 100%;
  box-sizing: border-box;
  padding: 6px 8px;
  border-radius: 4px;
  border: 1px solid var(--color-border, #4442);
  background: var(--color-background-mute, #f5f5f5);
  color: var(--color-text, #222);
}
button[type="submit"] {
  padding: 8px 18px;
  border-radius: 4px;
  background: var(--color-background-mute, #f5f5f5);
  color: var(--color-text, #222);
  border: 1px solid var(--color-border, #bbb);
  cursor: pointer;
  font-weight: 600;
  transition: background 0.2s;
}
button[type="submit"]:hover {
  background: var(--color-background-soft, #e0e0e0);
}
.channel-list {
  list-style: none;
  padding: 0;
  margin: 0;
  background: var(--color-background-mute, #232323);
  border: 1px solid var(--color-border, #4442);
  max-height: 180px;
  overflow-y: auto;
  position: absolute;
  z-index: 10;
  width: 320px;
  color: var(--color-text, #fff);
}
.channel-list li {
  cursor: pointer;
  margin-bottom: 4px;
  display: flex;
  align-items: center;
  padding: 4px 8px;
  background: transparent;
  color: var(--color-text, #fff);
}
.channel-list li:hover {
  background: var(--color-background-soft, #333);
}
img {
  margin-right: 8px;
}
.form-hint {
  color: var(--color-text-secondary, #aaa);
  font-size: 0.95em;
}
.image-list {
  list-style: none;
  padding: 0;
  margin: 0;
  background: var(--color-background-mute, #232323);
  border: 1px solid var(--color-border, #4442);
  max-height: 180px;
  overflow-y: auto;
  position: absolute;
  z-index: 10;
  width: 320px;
  color: var(--color-text, #fff);
}
.image-list li {
  cursor: pointer;
  margin-bottom: 4px;
  display: flex;
  align-items: center;
  padding: 4px 8px;
  background: transparent;
  color: var(--color-text, #fff);
}
.image-list li:hover {
  background: var(--color-background-soft, #333);
}
:deep(.el-dialog) {
  --el-dialog-bg-color: var(--color-background, #222);
}
</style>
