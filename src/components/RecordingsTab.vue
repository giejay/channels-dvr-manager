<template>
  <section class="recordings-container">
    <div class="section-header">
      <h3>Recordings</h3>
    </div>
    <div v-if="loading" class="loading-state">Loading recordings...</div>
    <div v-if="error" class="error-state">{{ error }}</div>
    <div v-if="!loading && !error">
      <!-- Desktop Table View -->
      <div class="table-wrapper desktop-only">
        <ElTable :data="displayedRecordings" stripe border>
          <ElTableColumn prop="Title" label="Title" min-width="320" show-overflow-tooltip />
          <ElTableColumn prop="Duration" label="Duration" :formatter="row => formatDuration(row.Duration)" min-width="70" max-width="90" />
          <ElTableColumn prop="StartTime" label="Start" :formatter="row => formatDate(row.StartTime)" min-width="110" max-width="140" />
          <ElTableColumn prop="ChannelName" label="Channel" min-width="140" />
          <ElTableColumn label="Actions" width="180" fixed="right">
            <template #default="scope">
              <ElButton type="primary" size="small" @click="viewStream(scope.row, 'vite')">VLC</ElButton>
              <ElButton type="default" size="small" @click="viewStream(scope.row, 'original')">Original</ElButton>
            </template>
          </ElTableColumn>
        </ElTable>
      </div>
      <!-- Mobile Card View -->
      <div class="cards-wrapper mobile-only">
        <div class="card-list">
          <div v-for="rec in displayedRecordings" :key="rec.ID" class="recording-card">
            <div class="card-header">
              <div class="card-title">{{ rec.Title }}</div>
              <ElButton type="primary" size="small" @click="viewStream(rec)">View</ElButton>
            </div>
            <div class="card-body">
              <div class="card-row"><span class="card-label">Duration:</span> <span class="card-value">{{ formatDuration(rec.Duration) }}</span></div>
              <div class="card-row"><span class="card-label">Start:</span> <span class="card-value">{{ formatDate(rec.StartTime) }}</span></div>
              <div class="card-row"><span class="card-label">Channel:</span> <span class="card-value">{{ rec.ChannelName }}</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <!-- Stream Dialog -->
    <ElDialog v-model="showStreamDialog" title="Watch Recording" width="90%" @close="closeStream">
      <div v-if="selectedRecording" class="stream-dialog">
        <div class="stream-info">
          <h3>{{ selectedRecording.Title }}</h3>
          <p><strong>Channel:</strong> {{ selectedRecording.ChannelName }}</p>
        </div>
        <div class="stream-container">
          <video ref="videoRef" controls autoplay style="width: 100%; max-height: 600px; background: #000;" />
        </div>
      </div>
    </ElDialog>
  </section>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElTable, ElTableColumn, ElButton, ElDialog, ElMessage } from 'element-plus'
import mpegts from 'mpegts.js'

const recordings = ref([])
const loading = ref(false)
const error = ref('')
const channels = ref([])
const showStreamDialog = ref(false)
const selectedRecording = ref(null)
const streamUrl = ref('')
const videoRef = ref(null)

const displayedRecordings = computed(() => recordings.value.slice(0, 40))

function formatDate(epoch) {
  const d = new Date(epoch * 1000)
  return d.toLocaleString()
}
function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return `${h}h ${m}m`
}

function getChannelName(channelId) {
  const ch = channels.value.find(c => c.ID == channelId || c.GuideNumber == channelId)
  return ch ? `${ch.GuideNumber} - ${ch.GuideName}` : channelId
}

function setupMpegtsPlayer(url) {
  if (mpegts.getFeatureList().mseLivePlayback) {
    if (window.mpegtsPlayer) {
      window.mpegtsPlayer.destroy()
      window.mpegtsPlayer = null
    }
    const player = mpegts.createPlayer({
      type: 'mpegts',
      url
    })
    player.attachMediaElement(videoRef.value)
    player.load()
    player.play()
    window.mpegtsPlayer = player
  }
}

function viewStream(rec, mode = 'vite') {
  selectedRecording.value = rec
  let baseUrl
  if (mode === 'vite') {
    baseUrl = import.meta.env.VITE_STREAM_URL || `http://${window.location.hostname}`
  } else {
    baseUrl = `http://${window.location.hostname}`
  }
  streamUrl.value = `${baseUrl}/dvr/files/${rec.ID}/stream.mpg`
  showStreamDialog.value = true
  setTimeout(() => {
    if (videoRef.value) setupMpegtsPlayer(streamUrl.value)
  }, 100)
}

function closeStream() {
  showStreamDialog.value = false
  selectedRecording.value = null
  streamUrl.value = ''
  if (window.mpegtsPlayer) {
    window.mpegtsPlayer.destroy()
    window.mpegtsPlayer = null
  }
}

async function loadChannels() {
  try {
    const res = await fetch('/api/devices')
    const devices = await res.json()
    channels.value = devices.flatMap(dev => dev.Channels)
  } catch (e) {
    channels.value = []
  }
}
async function loadRecordings() {
  loading.value = true
  error.value = ''
  try {
    const res = await fetch('/api/dvr/files?all=true&raw=false')
    if (!res.ok) throw new Error('Failed to fetch recordings')
    let data = await res.json()
    // Only show first 40
    data = data.slice(0, 40)
    // Attach channel name
    data.forEach(rec => {
      rec.ChannelName = getChannelName(rec.Airing.Channel)
      rec.StartTime = rec.StartTime || rec.Time || rec.Start || rec.CreatedAt
      rec.Title = rec.Airing.Title
    })
    recordings.value = data
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}
onMounted(() => {
  loadChannels()
  loadRecordings()
})

// Add these methods:
function openVLC(rec) {
  const baseUrl = import.meta.env.VITE_STREAM_URL || `http://${window.location.hostname}`
  window.open(`vlc://${baseUrl}/dvr/files/${rec.ID}/stream.mpg`, '_blank')
}
function openOriginal(rec) {
  const baseUrl = `http://${window.location.hostname}`
  window.open(`${baseUrl}/dvr/files/${rec.ID}/stream.mpg`, '_blank')
}
</script>

<style scoped>
.recordings-container {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.section-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}
.section-header h3 {
  margin: 0;
  color: var(--color-text);
  font-size: 1.1rem;
  font-weight: 600;
}
.table-wrapper {
  overflow-x: auto;
  margin-top: 1rem;
}
:deep(.el-table) {
  background: var(--color-background) !important;
  color: var(--color-text) !important;
}
:deep(.el-table__header),
:deep(.el-table__body),
:deep(.el-table__cell),
:deep(.el-table th),
:deep(.el-table td) {
  background: var(--color-background) !important;
  color: var(--color-text) !important;
}
:deep(.el-table__row:hover) {
  background: var(--color-background-soft) !important;
}
:deep(.el-table__header th) {
  font-weight: bold;
  background: var(--color-background-mute) !important;
}
.cards-wrapper {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.card-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.recording-card {
  background: var(--color-background-mute);
  border: 1px solid var(--color-background-soft);
  border-radius: 0.5rem;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: start;
  gap: 0.5rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--color-background-soft);
}
.card-title {
  font-weight: 600;
  font-size: 1rem;
  color: var(--color-text);
  flex: 1;
  word-break: break-word;
}
.card-body {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.card-row {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
.card-label {
  font-weight: 500;
  font-size: 0.875rem;
  color: var(--color-text-secondary, #999);
}
.card-value {
  font-size: 0.95rem;
  color: var(--color-text);
  word-break: break-word;
}
.loading-state,
.error-state {
  padding: 2rem 1rem;
  text-align: center;
  color: var(--color-text);
}
.error-state {
  color: #f56c6c;
}
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
@media (min-width: 1024px) {
  .desktop-only {
    display: block;
  }
  .mobile-only {
    display: none;
  }
}
@media (max-width: 1023px) {
  .desktop-only {
    display: none;
  }
  .mobile-only {
    display: block;
  }
}
</style>

