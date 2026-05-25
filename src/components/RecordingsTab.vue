<template>
  <section class="recordings-container">
    <div class="section-header">
      <h3>Recordings</h3>
    </div>

    <!-- Search Input -->
    <div class="search-bar">
      <input
        v-model="searchQuery"
        type="text"
        placeholder="Search recordings by title..."
        class="search-input"
      />
      <ElButton
        v-if="searchQuery"
        type="text"
        @click="clearSearch"
        style="padding: 0 0.5rem;"
      >
        Clear
      </ElButton>
    </div>

    <!-- Filter Controls -->
    <div class="filter-controls">
      <label>
        <input type="checkbox" v-model="showManualOnly" />
        Manual Only
      </label>
      <div v-if="selectedRecordings.length" class="bulk-actions">
        <span>{{ selectedRecordings.length }} selected</span>
        <ElButton type="danger" size="small" @click="showDeleteConfirm">Delete Selected</ElButton>
      </div>
    </div>
    <div v-if="loading" class="loading-state">Loading recordings...</div>
    <div v-if="error" class="error-state">{{ error }}</div>
    <div v-if="!loading && !error">
      <!-- Desktop Table View -->
      <div class="table-wrapper desktop-only">
        <ElTable :data="displayedRecordings" stripe border @selection-change="handleSelectionChange">
          <ElTableColumn type="selection" width="50" />
          <ElTableColumn prop="Title" label="Title" min-width="320" show-overflow-tooltip />
          <ElTableColumn prop="Duration" label="Duration" :formatter="row => formatDuration(row.Duration)" min-width="70" max-width="90" />
          <ElTableColumn prop="StartTime" label="Start" :formatter="row => formatDate(row.StartTime)" min-width="110" max-width="140" />
          <ElTableColumn prop="ChannelName" label="Channel" min-width="160">
            <template #default="scope">
              <span style="display:flex;align-items:center;gap:0.5em;">
                <img v-if="getChannelLogo(scope.row.Airing.Channel)" :src="getChannelLogo(scope.row.Airing.Channel)" :alt="'Logo'" style="height:1.5em;width:auto;max-width:2.5em;object-fit:contain;vertical-align:middle;" />
                <span>{{ scope.row.ChannelName }}</span>
              </span>
            </template>
          </ElTableColumn>
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
         <div class="cards-header">
           <div v-if="selectedRecordings.length" class="bulk-actions-mobile">
             <span>{{ selectedRecordings.length }} selected</span>
             <ElButton type="danger" size="small" @click="showDeleteConfirm">Delete Selected</ElButton>
           </div>
         </div>
         <div class="card-list">
           <div v-for="rec in displayedRecordings" :key="rec.ID" class="recording-card" :class="{ selected: isSelected(rec.ID) }">
             <div class="card-checkbox">
               <input type="checkbox" :checked="isSelected(rec.ID)" @change="toggleSelection(rec)" />
             </div>
            <div class="card-header">
              <div class="card-title">{{ rec.Title }}</div>
              <ElButton type="primary" size="small" @click="viewStream(rec)">View</ElButton>
            </div>
            <div class="card-body">
              <div class="card-row"><span class="card-label">Duration:</span> <span class="card-value">{{ formatDuration(rec.Duration) }}</span></div>
              <div class="card-row"><span class="card-label">Start:</span> <span class="card-value">{{ formatDate(rec.StartTime) }}</span></div>
              <div class="card-row"><span class="card-label">Channel:</span> <span class="card-value" style="display:flex;align-items:center;gap:0.5em;">
                <img v-if="getChannelLogo(rec.Airing.Channel)" :src="getChannelLogo(rec.Airing.Channel)" :alt="'Logo'" style="height:1.5em;width:auto;max-width:2.5em;object-fit:contain;vertical-align:middle;" />
                <span>{{ rec.ChannelName }}</span>
              </span></div>
            </div>
          </div>
        </div>
      </div>
     </div>
     <!-- Delete Confirmation Dialog -->
     <ElDialog v-model="showDeleteDialog" title="Confirm Deletion" width="400px" @confirm="deleteSelected">
       <div class="delete-confirmation">
         <p>Are you sure you want to delete {{ selectedRecordings.length }} recording(s)?</p>
         <p style="color: var(--color-text-secondary, #999); font-size: 0.9rem;">This action cannot be undone.</p>
       </div>
       <template #footer>
         <span class="dialog-footer">
           <ElButton @click="showDeleteDialog = false">Cancel</ElButton>
           <ElButton type="danger" @click="deleteSelected">Delete</ElButton>
         </span>
       </template>
     </ElDialog>
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
const showManualOnly = ref(false)
const selectedRecordings = ref([])
const showDeleteDialog = ref(false)
const searchQuery = ref('')

const filteredRecordings = computed(() => {
  let result = recordings.value

  // Apply manual only filter
  if (showManualOnly.value) {
    result = result.filter(rec => rec.Airing.Source === 'manual')
  }

  // Apply search filter
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(rec =>
      rec.Airing.Title.toLowerCase().includes(query) ||
      rec.ChannelName.toLowerCase().includes(query)
    )
  }

  return result
})

const displayedRecordings = computed(() => filteredRecordings.value.slice(0, 40))

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
// Utility: Get channel logo by channel number or ID
function getChannelLogo(channelNumberOrId) {
   const ch = channels.value.find(c => String(c.GuideNumber) === String(channelNumberOrId) || String(c.ID) === String(channelNumberOrId))
   return ch && ch.Logo ? ch.Logo : null
 }

function handleSelectionChange(selection) {
  selectedRecordings.value = selection
}

function isSelected(recordingId) {
  return selectedRecordings.value.some(rec => rec.ID === recordingId)
}

function toggleSelection(rec) {
  if (isSelected(rec.ID)) {
    selectedRecordings.value = selectedRecordings.value.filter(r => r.ID !== rec.ID)
  } else {
    selectedRecordings.value = [...selectedRecordings.value, rec]
  }
}

function showDeleteConfirm() {
  if (selectedRecordings.value.length === 0) {
    ElMessage.warning('No recordings selected')
    return
  }
  showDeleteDialog.value = true
}

async function deleteSelected() {
  showDeleteDialog.value = false
  const recordingIds = selectedRecordings.value.map(rec => rec.ID)

  try {
    for (const id of recordingIds) {
      const res = await fetch(`/api/dvr/files/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(`Failed to delete recording ${id}`)
    }
    ElMessage.success(`Deleted ${recordingIds.length} recording(s)`)
    selectedRecordings.value = []
    loadRecordings()
  } catch (e) {
    ElMessage.error(`Error deleting recordings: ${e.message}`)
  }
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

function clearSearch() {
  searchQuery.value = ''
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
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.5rem;
}
.section-header h3 {
   margin: 0;
   color: var(--color-text);
   font-size: 1.1rem;
   font-weight: 600;
 }
 .search-bar {
   display: flex;
   gap: 0.5rem;
   align-items: center;
   margin-bottom: 1rem;
 }
 .search-input {
   flex: 1;
   padding: 0.75rem;
   border-radius: 0.375rem;
   border: 1px solid var(--color-background-soft);
   background: var(--color-background-mute);
   color: var(--color-text);
   font-size: 1rem;
   transition: border-color 0.2s;
 }
 .search-input:focus {
   outline: none;
   border-color: #409eff;
   box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.2);
 }
 .search-input::placeholder {
   color: var(--color-text-secondary, #999);
 }
 .filter-controls {
  display: flex;
  align-items: center;
  gap: 1.5rem;
}
.filter-controls label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  color: var(--color-text);
  font-weight: normal;
  margin: 0;
  user-select: none;
}
.filter-controls input[type="checkbox"] {
  cursor: pointer;
  width: 18px;
  height: 18px;
}
.bulk-actions,
.bulk-actions-mobile {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem;
  background: var(--color-background-soft);
  border-radius: 0.375rem;
  color: var(--color-text);
  font-size: 0.9rem;
}
.bulk-actions-mobile {
  width: 100%;
  margin-bottom: 1rem;
  justify-content: space-between;
}
.cards-header {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
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
 .recording-card.selected {
   background: var(--color-background-soft);
   border-color: #409eff;
   box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.1);
 }
 .card-checkbox {
   display: flex;
   align-items: center;
 }
 .card-checkbox input[type="checkbox"] {
   cursor: pointer;
   width: 18px;
   height: 18px;
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
.delete-confirmation {
  color: var(--color-text);
}
.delete-confirmation p {
  margin: 0.5rem 0;
}
.dialog-footer {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
}
@media (min-width: 1024px) {
   .desktop-only {
     display: block;
   }
   .mobile-only {
     display: none;
   }
   .filter-controls {
     flex-direction: row;
   }
 }
 @media (max-width: 1023px) {
   .desktop-only {
     display: none;
   }
   .mobile-only {
     display: block;
   }
   .section-header {
     flex-direction: column;
     align-items: flex-start;
   }
   .filter-controls {
     width: 100%;
     flex-direction: column;
   }
   .filter-controls label {
     width: 100%;
   }
   .bulk-actions-mobile {
     width: 100%;
   }
 }
</style>

