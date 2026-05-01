<template>
  <div class="guide-container">
    <!-- Search Controls -->
    <div class="search-controls">
      <ElInput
        v-model="searchQuery"
        placeholder="Search programs (e.g. 'liverpool real madrid')..."
        clearable
        class="search-input"
        @keyup.enter="performLiveSearch"
      />
      <div class="button-group">
        <ElButton type="primary" @click="performLiveSearch" class="search-button">
          Live Search
        </ElButton>
        <ElButton @click="performDeepSearch" :loading="searching" class="deep-search-button">
          Deep Search
        </ElButton>
      </div>
    </div>

    <!-- Results Section -->
    <div v-if="showSearchResults" class="results-section">
      <!-- Deep Search Results -->
      <div v-if="searchResults.length > 0" class="deep-search-results">
        <div class="results-header">
          <h3>Deep Search Results</h3>
          <ElButton type="text" @click="clearDeepSearch">Clear</ElButton>
        </div>

        <div v-if="searchError" class="error-message">{{ searchError }}</div>

        <div v-if="searchResults.length > 0" class="debug-info">
          <strong>Results:</strong> {{ searchResults.length }} total | {{ groupedResults.length }} dates
        </div>

        <!-- Results grouped by date -->
        <div class="results-container">
          <div v-for="(group, index) in groupedResults" :key="index" class="date-group">
            <h3 class="date-header">{{ formatDateHeader(group.date) }} <span class="count">({{ group.airings.length }})</span></h3>

            <!-- Desktop Table -->
            <div class="results-table-wrapper desktop-only">
              <ElTable :data="group.airings" stripe border>
                <ElTableColumn prop="Title" label="Title" sortable min-width="150" show-overflow-tooltip />
                <ElTableColumn prop="Channel" label="Channel" :formatter="formatChannel" min-width="100" />
                <ElTableColumn prop="Summary" label="Summary" show-overflow-tooltip min-width="200" />
                <ElTableColumn prop="Time" label="Start" :formatter="row => formatDate(row.Time)" sortable min-width="150" />
                <ElTableColumn prop="Duration" label="Duration" :formatter="row => formatDuration(row.Duration)" min-width="80" />
                <ElTableColumn label="Actions" width="100" fixed="right">
                  <template #default="scope">
                    <ElButton type="primary" size="small" @click="recordFromSearch(scope.row)">
                      Record
                    </ElButton>
                  </template>
                </ElTableColumn>
              </ElTable>
            </div>

            <!-- Mobile Cards -->
            <div class="results-cards-wrapper mobile-only">
              <div v-for="(airing, idx) in group.airings" :key="idx" class="airing-card">
                <div class="airing-header">
                  <div class="airing-title">{{ airing.Title }}</div>
                  <ElButton type="primary" size="small" @click="recordFromSearch(airing)">Record</ElButton>
                </div>
                <div class="airing-details">
                  <div class="detail-row">
                    <span class="detail-label">Channel:</span>
                    <span class="detail-value">{{ formatChannel(airing) }}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Start:</span>
                    <span class="detail-value">{{ formatDate(airing.Time) }}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Duration:</span>
                    <span class="detail-value">{{ formatDuration(airing.Duration) }}</span>
                  </div>
                  <div v-if="airing.Summary" class="detail-row">
                    <span class="detail-label">Summary:</span>
                    <span class="detail-value">{{ airing.Summary }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Live Search Results -->
      <div v-else-if="liveSearchResults.length > 0" class="live-search-results">
        <div class="results-header">
          <h3>Current Programs</h3>
          <ElButton type="text" @click="clearLiveSearch">Clear</ElButton>
        </div>

        <!-- Desktop Table View -->
        <div class="table-wrapper desktop-only">
          <ElTable :data="liveSearchResults" stripe border>
            <ElTableColumn prop="Channel" label="Channel" min-width="120" :formatter="formatChannelName" />
            <ElTableColumn prop="Title" label="Title" sortable min-width="200" show-overflow-tooltip />
            <ElTableColumn prop="Summary" label="Summary" min-width="250" show-overflow-tooltip />
            <ElTableColumn prop="StartTime" label="Start" min-width="150" :formatter="row => formatTime(row.StartTime)" />
            <ElTableColumn prop="Duration" label="Duration" min-width="80" :formatter="row => formatDuration(row.Duration)" />
            <ElTableColumn label="Actions" width="120" fixed="right">
              <template #default="scope">
                <ElButton type="primary" size="small" @click="viewStream(scope.row)">
                  View
                </ElButton>
              </template>
            </ElTableColumn>
          </ElTable>
        </div>

        <!-- Mobile Card View -->
        <div class="cards-wrapper mobile-only">
          <div class="card-list">
            <div v-for="program in liveSearchResults" :key="program.Channel" class="program-card">
              <div class="card-header">
                <div class="channel-info">
                  <div class="channel-name">{{ formatChannelName(program) }}</div>
                  <div class="program-title">{{ program.Title }}</div>
                </div>
                <ElButton type="primary" size="small" @click="viewStream(program)">
                  View
                </ElButton>
              </div>
              <div class="card-body">
                <div v-if="program.Summary" class="detail-row">
                  <span class="detail-label">Summary:</span>
                  <span class="detail-value">{{ program.Summary }}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Start:</span>
                  <span class="detail-value">{{ formatTime(program.StartTime) }}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Duration:</span>
                  <span class="detail-value">{{ formatDuration(program.Duration) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Default View - All Current Programs -->
    <div v-if="!showSearchResults">
      <div class="section-header">
        <h3>Currently Airing</h3>
      </div>

      <!-- Loading/Error States -->
      <div v-if="loadingLive" class="loading-state">Loading current programs...</div>
      <div v-if="errorLive" class="error-state">{{ errorLive }}</div>

      <!-- Desktop Table View -->
      <div v-if="!loadingLive && !errorLive" class="table-wrapper desktop-only">
        <ElTable :data="filteredLivePrograms" stripe border>
          <ElTableColumn prop="Channel" label="Channel" min-width="120" :formatter="formatChannelName" />
          <ElTableColumn prop="Title" label="Title" sortable min-width="200" show-overflow-tooltip />
          <ElTableColumn prop="Summary" label="Summary" min-width="250" show-overflow-tooltip />
          <ElTableColumn prop="StartTime" label="Start" min-width="150" :formatter="row => formatTime(row.StartTime)" />
          <ElTableColumn prop="Duration" label="Duration" min-width="80" :formatter="row => formatDuration(row.Duration)" />
          <ElTableColumn label="Actions" width="120" fixed="right">
            <template #default="scope">
              <ElButton type="primary" size="small" @click="viewStream(scope.row)">
                View
              </ElButton>
            </template>
          </ElTableColumn>
        </ElTable>
      </div>

      <!-- Mobile Card View -->
      <div v-if="!loadingLive && !errorLive" class="cards-wrapper mobile-only">
        <div v-if="filteredLivePrograms.length > 0" class="card-list">
          <div v-for="program in filteredLivePrograms" :key="program.Channel" class="program-card">
            <div class="card-header">
              <div class="channel-info">
                <div class="channel-name">{{ formatChannelName(program) }}</div>
                    <div class="program-title">{{ program.Title }}</div>
              </div>
              <ElButton type="primary" size="small" @click="viewStream(program)">
                View
              </ElButton>
            </div>
            <div class="card-body">
              <div v-if="program.Summary" class="detail-row">
                <span class="detail-label">Summary:</span>
                <span class="detail-value">{{ program.Summary }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Start:</span>
                <span class="detail-value">{{ formatTime(program.StartTime) }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Duration:</span>
                <span class="detail-value">{{ formatDuration(program.Duration) }}</span>
              </div>
            </div>
          </div>
        </div>
        <div v-else class="empty-state">
          No programs currently airing
        </div>
      </div>
      </div>
    </div>

    <!-- Stream Dialog -->
    <ElDialog
      v-model="showStreamDialog"
      title="Watch Stream"
      width="90%"
      @close="closeStream"
    >
      <div v-if="selectedProgram" class="stream-dialog">
        <div class="stream-info">
          <h3>{{ selectedProgram.Title }}</h3>
          <p><strong>Channel:</strong> {{ formatChannelName(selectedProgram) }}</p>
          <p v-if="selectedProgram.Summary"><strong>Summary:</strong> {{ selectedProgram.Summary }}</p>
        </div>
        <div class="stream-container">
          <video
            :src="streamUrl"
            controls
            autoplay
            style="width: 100%; max-height: 600px; background: #000;"
          />
        </div>
      </div>
    </ElDialog>

    <!-- Recording Dialog from Search -->
    <ElDialog v-model="showRecordDialog" title="Create Recording" @close="recordDialogAiring = null">
      <div v-if="recordDialogAiring" class="record-dialog-content">
        <div class="dialog-row">
          <span class="dialog-label">Title:</span>
          <span class="dialog-value">{{ recordDialogAiring.Title }}</span>
        </div>
        <div class="dialog-row">
          <span class="dialog-label">Channel:</span>
          <span class="dialog-value">{{ formatChannel(recordDialogAiring) }}</span>
        </div>
        <div class="dialog-row">
          <span class="dialog-label">Start:</span>
          <span class="dialog-value">{{ formatDate(recordDialogAiring.Time) }}</span>
        </div>
        <div class="dialog-row">
          <span class="dialog-label">Duration:</span>
          <span class="dialog-value">{{ formatDuration(recordDialogAiring.Duration) }}</span>
        </div>
        <div v-if="recordDialogAiring.Summary" class="dialog-row">
          <span class="dialog-label">Summary:</span>
          <span class="dialog-value">{{ recordDialogAiring.Summary }}</span>
        </div>
      </div>
      <template #footer>
        <span class="dialog-footer">
          <ElButton @click="showRecordDialog = false">Cancel</ElButton>
          <ElButton type="primary" @click="confirmRecord">Confirm</ElButton>
        </span>
      </template>
    </ElDialog>
</template>

<script setup>
import { ref, computed } from 'vue'
import { ElTable, ElTableColumn, ElInput, ElButton, ElDialog, ElMessage } from 'element-plus'

// Live Guide state
const loadingLive = ref(false)
const errorLive = ref('')
const livePrograms = ref([])
const channels = ref([])
const showStreamDialog = ref(false)
const selectedProgram = ref(null)
const streamUrl = ref('')

// Search state
const searchQuery = ref('')
const searching = ref(false)
const searchError = ref('')
const searchResults = ref([])
const hasSearched = ref(false)
const showRecordDialog = ref(false)
const recordDialogAiring = ref(null)

// UI state
const showSearchResults = ref(false)
const liveSearchResults = ref([])

// ... existing code ...

// Computed: All live programs (no filter)
const filteredLivePrograms = computed(() => {
  return livePrograms.value
})

// Computed: Group search results by date
const groupedResults = computed(() => {
  const groups = {}
  searchResults.value.forEach((airing, index) => {
    const date = new Date(airing.Time * 1000)
    const dateKey = date.toISOString().split('T')[0]
    if (!groups[dateKey]) {
      groups[dateKey] = { date: dateKey, airings: [] }
    }
    groups[dateKey].airings.push(airing)
  })
  const groupArray = Object.values(groups)
  return groupArray.sort((a, b) => new Date(a.date) - new Date(b.date))
})

// Format utilities
function formatChannelName(program) {
  return `${program.Channel} - ${program.ChannelName}`
}

function formatTime(epoch) {
  const d = new Date(epoch * 1000)
  return d.toLocaleString()
}

function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return `${h}h ${m}m`
}

// View stream
function viewStream(program) {
  selectedProgram.value = program
  // Build stream URL from environment variable or default
  const baseUrl = import.meta.env.VITE_STREAM_URL || 'http://www.channels.local'
  streamUrl.value = `${baseUrl}/devices/ANY/channels/${program.Channel}/stream.mpg`
  showStreamDialog.value = true
}

function closeStream() {
  showStreamDialog.value = false
  selectedProgram.value = null
  streamUrl.value = ''
}

// Load channels
async function loadChannels() {
  try {
    const res = await fetch('/api/devices')
    const devices = await res.json()
    channels.value = devices.flatMap(dev => dev.Channels)
  } catch (e) {
    console.error('Failed to load channels:', e)
    channels.value = []
  }
}

// Load current live programs
async function loadCurrentPrograms() {
  loadingLive.value = true
  errorLive.value = ''

  try {
    const now = Math.floor(Date.now() / 1000)
    const res = await fetch(`/api/devices/ANY/guide?time=${now}`)
    if (!res.ok) throw new Error('Failed to fetch guide data')

    const data = await res.json()
    const currentPrograms = []

    if (Array.isArray(data)) {
      data.forEach(item => {
        if (item.Airings && Array.isArray(item.Airings)) {
          const currentAiring = item.Airings.find(airing => {
            const startTime = airing.Time
            const endTime = airing.Time + airing.Duration
            return now >= startTime && now < endTime
          })

          if (currentAiring) {
            currentPrograms.push({
              Channel: currentAiring.Channel || item.Channel?.Number,
              ChannelName: item.Channel?.ChannelID || 'Unknown',
              Title: currentAiring.Title || 'Unknown',
              Summary: currentAiring.Summary || '',
              StartTime: currentAiring.Time,
              Duration: currentAiring.Duration
            })
          }
        }
      })
    }

    livePrograms.value = currentPrograms
    if (currentPrograms.length === 0) {
      errorLive.value = 'No programs currently airing'
    }
  } catch (e) {
    console.error('Failed to load programs:', e)
    errorLive.value = `Failed to load programs: ${e.message}`
  } finally {
    loadingLive.value = false
  }
}

// Search functionality
async function performSearch() {
  if (!searchQuery.value.trim()) {
    ElMessage.warning('Please enter a search query')
    return
  }

  searching.value = true
  searchError.value = ''
  searchResults.value = []

  try {
    hasSearched.value = true
    const now = Math.floor(Date.now() / 1000)
    const sixHours = 6 * 60 * 60
    const timeSlots = []

    for (let i = 0; i < 16; i++) {
      const time = now + (i * sixHours)
      timeSlots.push(time)
    }

    const fetchPromises = timeSlots.map(time =>
      fetch(`/api/devices/ANY/guide?time=${time}`)
        .then(res => {
          if (!res.ok) throw new Error(`Failed to fetch guide for time ${time}`)
          return res.json()
        })
        .catch(e => {
          console.warn(`Failed to fetch time slot:`, e.message)
          return []
        })
    )

    const allData = await Promise.all(fetchPromises)
    const searchTerms = parseSearchTerms(searchQuery.value)
    const results = []
    const dedupeSet = new Set()

    allData.forEach((data) => {
      if (Array.isArray(data)) {
        data.forEach((item) => {
          if (item.Airings && Array.isArray(item.Airings)) {
            item.Airings.forEach((airing) => {
              const airingId = `${airing.Channel || item.Channel?.Number}-${airing.Time}-${airing.Title}`
              if (dedupeSet.has(airingId)) return

              const title = airing.Title || ''
              const summary = airing.Summary || ''
              const combined = `${title} ${summary}`

              if (matchesAllTerms(combined, searchTerms)) {
                dedupeSet.add(airingId)
                results.push({
                  ...airing,
                  Channel: airing.Channel || item.Channel?.Number
                })
              }
            })
          }
        })
      }
    })

    results.sort((a, b) => a.Time - b.Time)
    searchResults.value = results

    if (results.length === 0) {
      searchError.value = `No results found for "${searchQuery.value}"`
    }
  } catch (e) {
    console.error('Search error:', e)
    searchError.value = `Search failed: ${e.message}`
  } finally {
    searching.value = false
  }
}

function parseSearchTerms(query) {
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(term => term.length > 0)
}

function matchesAllTerms(text, terms) {
  if (!text) return false
  const lowerText = text.toLowerCase()
  return terms.every(term => lowerText.includes(term))
}

function formatChannel(airing) {
  if (!airing.Channel) return 'Unknown'
  const ch = channels.value.find(c => c.GuideNumber == airing.Channel)
  return ch ? `${ch.GuideNumber} - ${ch.GuideName}` : airing.Channel
}

function formatDate(epoch) {
  const d = new Date(epoch * 1000)
  return d.toLocaleString()
}

function formatDateHeader(dateStr) {
  const d = new Date(dateStr)
  const options = { weekday: 'long', month: 'long', day: 'numeric' }
  return d.toLocaleDateString('en-US', options)
}

function recordFromSearch(airing) {
  recordDialogAiring.value = airing
  showRecordDialog.value = true
}

async function confirmRecord() {
  if (!recordDialogAiring.value) return

  try {
    const paddedDuration = recordDialogAiring.value.Duration + 3600

    const payload = {
      Name: recordDialogAiring.value.Title,
      Time: recordDialogAiring.value.Time,
      Duration: paddedDuration,
      Channels: [recordDialogAiring.value.Channel],
      Airing: {
        Source: recordDialogAiring.value.Source || 'xmltv:IPTVBoss',
        Channel: recordDialogAiring.value.Channel,
        Time: recordDialogAiring.value.Time,
        Duration: recordDialogAiring.value.Duration,
        Title: recordDialogAiring.value.Title,
        Summary: recordDialogAiring.value.Summary || '',
        SeriesID: recordDialogAiring.value.SeriesID || recordDialogAiring.value.Title,
        ProgramID: recordDialogAiring.value.ProgramID || recordDialogAiring.value.Title,
        ContentRating: recordDialogAiring.value.ContentRating || '',
        SearchScore: recordDialogAiring.value.SearchScore || 0,
        Raw: recordDialogAiring.value.Raw || {}
      }
    }

    const res = await fetch('/api/dvr/jobs/new', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })

    if (!res.ok) throw new Error('Failed to create recording')

    ElMessage.success('Recording created!')
    showRecordDialog.value = false
    recordDialogAiring.value = null
  } catch (e) {
    ElMessage.error(`Failed to create recording: ${e.message}`)
  }
}

// Perform live search - filter current programs
function performLiveSearch() {
  if (!searchQuery.value.trim()) {
    showSearchResults.value = false
    return
  }

  const query = searchQuery.value.toLowerCase()
  liveSearchResults.value = livePrograms.value.filter(program =>
    program.Title.toLowerCase().includes(query) ||
    program.ChannelName.toLowerCase().includes(query) ||
    String(program.Channel).includes(query)
  )

  showSearchResults.value = true
}

// Perform deep search - search upcoming programs
async function performDeepSearch() {
  if (!searchQuery.value.trim()) {
    ElMessage.warning('Please enter a search query')
    return
  }

  searching.value = true
  searchError.value = ''
  searchResults.value = []

  try {
    hasSearched.value = true
    const now = Math.floor(Date.now() / 1000)
    const sixHours = 6 * 60 * 60
    const timeSlots = []

    for (let i = 0; i < 16; i++) {
      const time = now + (i * sixHours)
      timeSlots.push(time)
    }

    const fetchPromises = timeSlots.map(time =>
      fetch(`/api/devices/ANY/guide?time=${time}`)
        .then(res => {
          if (!res.ok) throw new Error(`Failed to fetch guide for time ${time}`)
          return res.json()
        })
        .catch(e => {
          console.warn(`Failed to fetch time slot:`, e.message)
          return []
        })
    )

    const allData = await Promise.all(fetchPromises)
    const searchTerms = parseSearchTerms(searchQuery.value)
    const results = []
    const dedupeSet = new Set()

    allData.forEach((data) => {
      if (Array.isArray(data)) {
        data.forEach((item) => {
          if (item.Airings && Array.isArray(item.Airings)) {
            item.Airings.forEach((airing) => {
              const airingId = `${airing.Channel || item.Channel?.Number}-${airing.Time}-${airing.Title}`
              if (dedupeSet.has(airingId)) return

              const title = airing.Title || ''
              const summary = airing.Summary || ''
              const channelId = item.Channel?.ChannelID || ''
              const combined = `${title} ${summary} ${channelId}`

              if (matchesAllTerms(combined, searchTerms)) {
                dedupeSet.add(airingId)
                results.push({
                  ...airing,
                  Channel: airing.Channel || item.Channel?.Number
                })
              }
            })
          }
        })
      }
    })

    results.sort((a, b) => a.Time - b.Time)
    searchResults.value = results
    showSearchResults.value = true

    if (results.length === 0) {
      searchError.value = `No results found for "${searchQuery.value}"`
    }
  } catch (e) {
    console.error('Search error:', e)
    searchError.value = `Search failed: ${e.message}`
  } finally {
    searching.value = false
  }
}

function clearLiveSearch() {
  searchQuery.value = ''
  liveSearchResults.value = []
  showSearchResults.value = false
}

function clearDeepSearch() {
  searchQuery.value = ''
  searchResults.value = []
  showSearchResults.value = false
  searchError.value = ''
}

// Initialize on mount
loadChannels()
loadCurrentPrograms()
</script>

<style scoped>
.guide-container {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* Guide Tabs */
.guide-tabs {
  width: 100%;
}

:deep(.guide-tabs .el-tabs__header) {
  background: var(--color-background);
  border-bottom: 1px solid var(--color-background-soft);
}

:deep(.guide-tabs .el-tabs__nav-wrap) {
  background: var(--color-background);
}

:deep(.guide-tabs .el-tabs__item) {
  color: var(--color-text) !important;
}

:deep(.guide-tabs .el-tabs__item.is-active) {
  color: #409eff !important;
}

:deep(.guide-tabs .el-tabs__item:hover) {
  color: var(--color-text) !important;
}

:deep(.guide-tabs .el-tabs__content) {
  color: var(--color-text);
}

/* Tab Section */
.tab-section {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* Section Header */
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

/* Results Header */
.results-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--color-background-soft);
}

.results-header h3 {
  margin: 0;
  color: var(--color-text);
  font-size: 1.1rem;
  font-weight: 600;
}

/* Results Section */
.results-section {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* Filter Section */
.filter-section {
  display: flex;
  gap: 0.75rem;
}

.filter-input {
  width: 100%;
}

/* Loading/Error States */
.loading-state,
.error-state,
.empty-state {
  padding: 2rem 1rem;
  text-align: center;
  color: var(--color-text);
}

.error-state {
  color: #f56c6c;
}

/* Desktop Table View */
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

/* Mobile Card View */
.mobile-only {
  display: block;
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

.program-card {
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

.channel-info {
  flex: 1;
}

.channel-name {
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--color-text-secondary, #999);
  margin-bottom: 0.25rem;
}

.program-title {
  font-weight: 600;
  font-size: 1rem;
  color: var(--color-text);
  word-break: break-word;
}

.card-body {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.detail-row {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.detail-label {
  font-weight: 500;
  font-size: 0.875rem;
  color: var(--color-text-secondary, #999);
}

.detail-value {
  font-size: 0.95rem;
  color: var(--color-text);
  word-break: break-word;
}

/* Stream Dialog */
.stream-dialog {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.stream-info {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.stream-info h3 {
  margin: 0;
  color: var(--color-text);
}

.stream-info p {
  margin: 0;
  color: var(--color-text);
  font-size: 0.95rem;
}

.stream-container {
  width: 100%;
  background: #000;
  border-radius: 0.5rem;
  overflow: hidden;
}

/* Search Results Styling */
.search-controls {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.search-input {
  width: 100%;
}

.button-group {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  width: 100%;
}

.search-button,
.deep-search-button,
.clear-button {
  flex: 1;
  min-width: 0;
}

@media (min-width: 640px) {
  .search-controls {
    flex-direction: row;
    align-items: center;
    gap: 1rem;
  }

  .search-input {
    flex: 1;
    min-width: 300px;
  }

  .button-group {
    flex-wrap: nowrap;
    flex: 0 0 auto;
    width: auto;
  }

  .search-button,
  .deep-search-button,
  .clear-button {
    flex: 0 0 auto;
    min-width: auto;
  }
}

.error-message {
  padding: 1rem;
  background: rgba(245, 108, 108, 0.15);
  color: #f56c6c;
  border-radius: 0.5rem;
  border-left: 3px solid #f56c6c;
}

.debug-info {
  padding: 0.75rem;
  background: var(--color-background-mute);
  border-radius: 0.5rem;
  font-size: 0.875rem;
  color: var(--color-text-secondary, #999);
  margin-bottom: 10px;
}

.results-container {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding-bottom: 1rem;
}

.date-group {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.date-header {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--color-text);
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.date-header .count {
  font-size: 0.9rem;
  font-weight: normal;
  color: var(--color-text-secondary, #999);
}

.results-table-wrapper {
  overflow-x: auto;
}

.results-cards-wrapper {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.airing-card {
  background: var(--color-background-mute);
  border: 1px solid var(--color-background-soft);
  border-radius: 0.5rem;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.airing-header {
  display: flex;
  justify-content: space-between;
  align-items: start;
  gap: 0.5rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--color-background-soft);
}

.airing-title {
  font-weight: 600;
  color: var(--color-text);
  flex: 1;
  word-break: break-word;
}

.airing-details {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

/* Record Dialog */
.record-dialog-content {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.dialog-row {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.dialog-label {
  font-weight: 600;
  color: var(--color-text);
  font-size: 0.9rem;
}

.dialog-value {
  color: var(--color-text);
  word-break: break-word;
}

.dialog-footer {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
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

/* Desktop: Show table, hide cards */
@media (min-width: 1024px) {
  .desktop-only {
    display: block;
  }

  .mobile-only {
    display: none;
  }
}

/* Mobile Only */
@media (max-width: 1023px) {
  .desktop-only {
    display: none;
  }

  .mobile-only {
    display: block;
  }

  .results-cards-wrapper.mobile-only {
    display: flex;
  }
}
</style>

