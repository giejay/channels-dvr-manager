<template>
  <div class="guide-search-container">
    <div style="display:flex;gap:12px;align-items:center;margin-bottom:16px;">
      <ElInput
        v-model="searchQuery"
        placeholder="Search for recordings (e.g. 'liverpool real madrid')"
        style="flex:1;max-width:600px"
        @keyup.enter="performSearch"
      />
      <ElButton type="primary" @click="performSearch" :loading="searching">
        Search
      </ElButton>
      <ElButton @click="clearSearch" v-if="searchResults.length > 0">
        Clear
      </ElButton>
    </div>

    <div v-if="searchError" style="color:red;margin-bottom:16px;">{{ searchError }}</div>

    <!-- Debug info -->
    <div v-if="searchResults.length > 0" style="background:var(--color-background-mute);padding:12px;margin-bottom:16px;border-radius:4px;font-size:12px;color:var(--color-text);">
      <strong>Debug Info:</strong>
      <div>Total results: {{ searchResults.length }}</div>
      <div>Grouped into: {{ groupedResults.length }} dates</div>
      <div>Groups: {{ groupedResults.map(g => `${g.date} (${g.airings.length})`).join(', ') }}</div>
    </div>

    <!-- Results grouped by date -->
    <div v-if="searchResults.length > 0">
      <div v-for="(group, index) in groupedResults" :key="index" style="margin-bottom:32px;">
        <h3 style="color:var(--color-text);margin-bottom:16px;">{{ formatDateHeader(group.date) }} ({{ group.airings.length }} airings)</h3>
        <ElTable
          :data="group.airings"
          style="width:100%;"
          border
          stripe
        >
          <ElTableColumn prop="Title" label="Title" sortable min-width="200" />
          <ElTableColumn prop="Channel" label="Channel" :formatter="formatChannel" min-width="130" />
          <ElTableColumn prop="Summary" label="Summary" show-overflow-tooltip min-width="250" />
          <ElTableColumn prop="Time" label="Start" :formatter="row => formatDate(row.Time)" sortable min-width="180" />
          <ElTableColumn prop="Duration" label="Duration" :formatter="row => formatDuration(row.Duration)" min-width="80" />
          <ElTableColumn label="Actions" min-width="100">
            <template #default="scope">
              <ElButton type="primary" size="small" @click="createFromAiring(scope.row)">
                Record
              </ElButton>
            </template>
          </ElTableColumn>
        </ElTable>
      </div>
    </div>

    <div v-else-if="!searching && searchQuery && hasSearched">
      <ElEmpty description="No results found" />
    </div>

    <!-- Dialog for quick recording creation from airing -->
    <ElDialog v-model="showRecordDialog" title="Create Recording" width="600px" @close="recordDialogAiring = null">
      <div v-if="recordDialogAiring">
        <p><strong>Title:</strong> {{ recordDialogAiring.Title }}</p>
        <p><strong>Channel:</strong> {{ formatChannel(recordDialogAiring) }}</p>
        <p><strong>Start:</strong> {{ formatDate(recordDialogAiring.Time) }}</p>
        <p><strong>Duration:</strong> {{ formatDuration(recordDialogAiring.Duration) }}</p>
        <p v-if="recordDialogAiring.Summary"><strong>Summary:</strong> {{ recordDialogAiring.Summary }}</p>
      </div>
      <template #footer>
        <span class="dialog-footer">
          <ElButton @click="showRecordDialog = false">Cancel</ElButton>
          <ElButton type="primary" @click="confirmRecord">Confirm</ElButton>
        </span>
      </template>
    </ElDialog>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { ElTable, ElTableColumn, ElInput, ElButton, ElEmpty, ElDialog, ElMessage } from 'element-plus'

const searchQuery = ref('')
const searching = ref(false)
const searchError = ref('')
const searchResults = ref([])
const channels = ref([])
const showRecordDialog = ref(false)
const recordDialogAiring = ref(null)
const hasSearched = ref(false)

const emit = defineEmits(['recording-created'])

// Group results by date
const groupedResults = computed(() => {
  console.log('=== GROUPING RESULTS ===')
  console.log('searchResults.value length:', searchResults.value.length)

  const groups = {}

  searchResults.value.forEach((airing, index) => {
    const date = new Date(airing.Time * 1000)
    const dateKey = date.toISOString().split('T')[0] // YYYY-MM-DD

    console.log(`Airing ${index}:`, {
      title: airing.Title,
      time: airing.Time,
      date: date.toISOString(),
      dateKey: dateKey
    })

    if (!groups[dateKey]) {
      groups[dateKey] = {
        date: dateKey,
        airings: []
      }
      console.log(`Created new group for date: ${dateKey}`)
    }

    groups[dateKey].airings.push(airing)
  })

  const groupArray = Object.values(groups)
  console.log('Total groups:', groupArray.length)
  console.log('Groups:', groupArray.map(g => ({ date: g.date, count: g.airings.length })))

  // Sort by date
  const sorted = groupArray.sort((a, b) => new Date(a.date) - new Date(b.date))
  console.log('Sorted groups:', sorted.map(g => ({ date: g.date, count: g.airings.length })))
  console.log('=== END GROUPING ===')

  return sorted
})

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

// Parse search query into individual terms
function parseSearchTerms(query) {
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(term => term.length > 0)
}

// Check if all search terms are present in text
function matchesAllTerms(text, terms) {
  if (!text) return false
  const lowerText = text.toLowerCase()
  return terms.every(term => lowerText.includes(term))
}

// Perform search
async function performSearch() {
  if (!searchQuery.value.trim()) {
    ElMessage.warning('Please enter a search query')
    return
  }

  searching.value = true
  searchError.value = ''
  searchResults.value = []

  try {
    console.log('=== STARTING SEARCH ===')
    console.log('Search query:', searchQuery.value)

    hasSearched.value = true

    // Get current time in seconds
    const now = Math.floor(Date.now() / 1000)
    console.log('Current time (seconds):', now)

    // Make 16 API calls (6 hours each = 4 days total)
    const sixHours = 6 * 60 * 60 // 21600 seconds
    const timeSlots = []

    for (let i = 0; i < 16; i++) {
      const time = now + (i * sixHours)
      timeSlots.push(time)
    }

    console.log(`Fetching guide data for ${timeSlots.length} time slots (4 days, 6-hour chunks)`)
    console.log('Time slots:', timeSlots.map(t => new Date(t * 1000).toISOString()).join(', '))

    // Fetch all time slots in parallel
    const fetchPromises = timeSlots.map(time =>
      fetch(`/api/devices/ANY/guide?time=${time}`)
        .then(res => {
          if (!res.ok) throw new Error(`Failed to fetch guide for time ${time}`)
          return res.json()
        })
        .catch(e => {
          console.warn(`Failed to fetch time slot ${new Date(time * 1000).toISOString()}:`, e.message)
          return [] // Return empty array on error for this slot
        })
    )

    const allData = await Promise.all(fetchPromises)
    console.log('All time slots fetched')

    // Parse search terms
    const searchTerms = parseSearchTerms(searchQuery.value)
    console.log('Search terms parsed:', searchTerms)

    // Search through all airings from all time slots
    const results = []
    let totalAiringsChecked = 0
    let matchesFound = 0
    const dedupeSet = new Set() // Track unique airings by ID

    allData.forEach((data, slotIndex) => {
      console.log(`Processing time slot ${slotIndex}: ${data.length} channels`)

      if (Array.isArray(data)) {
        data.forEach((item, itemIndex) => {
          if (item.Airings && Array.isArray(item.Airings)) {
            item.Airings.forEach((airing) => {
              totalAiringsChecked++

              // Create unique ID to avoid duplicates across time slots
              const airingId = `${airing.Channel || item.Channel?.Number}-${airing.Time}-${airing.Title}`

              if (dedupeSet.has(airingId)) {
                console.log(`Skipping duplicate airing: ${airing.Title}`)
                return
              }

              const title = airing.Title || ''
              const summary = airing.Summary || ''
              const combined = `${title} ${summary}`

              if (matchesAllTerms(combined, searchTerms)) {
                matchesFound++
                dedupeSet.add(airingId)
                console.log(`MATCH ${matchesFound}: "${title}" on ${new Date(airing.Time * 1000).toISOString()}`)
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

    console.log(`Total airings checked: ${totalAiringsChecked}`)
    console.log(`Total matches found: ${matchesFound}`)
    console.log(`Duplicates removed: ${totalAiringsChecked - results.length - (matchesFound - results.length)}`)

    // Sort by time
    results.sort((a, b) => a.Time - b.Time)
    console.log('Results sorted by time')

    searchResults.value = results
    console.log('searchResults.value set to:', results.length, 'items')
    console.log('Result dates:', results.map(r => new Date(r.Time * 1000).toISOString().split('T')[0]).filter((v, i, a) => a.indexOf(v) === i).join(', '))

    if (results.length === 0) {
      searchError.value = `No results found for "${searchQuery.value}"`
    }

    console.log('=== SEARCH COMPLETE ===')
  } catch (e) {
    console.error('Search error:', e)
    searchError.value = `Search failed: ${e.message}`
  } finally {
    searching.value = false
  }
}

// Format utilities
function formatDate(epoch) {
  const d = new Date(epoch * 1000)
  return d.toLocaleString()
}

function formatDateHeader(dateStr) {
  const d = new Date(dateStr)
  const options = { weekday: 'long', month: 'long', day: 'numeric' }
  return d.toLocaleDateString('en-US', options)
}

function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return `${h}h ${m}m`
}

function formatChannel(airing) {
  if (!airing.Channel) return 'Unknown'
  const ch = channels.value.find(c => c.GuideNumber == airing.Channel)
  return ch ? `${ch.GuideNumber} - ${ch.GuideName}` : airing.Channel
}

// Create recording from airing
function createFromAiring(airing) {
  recordDialogAiring.value = airing
  showRecordDialog.value = true
}

async function confirmRecord() {
  if (!recordDialogAiring.value) return

  try {
    const payload = {
      Name: recordDialogAiring.value.Title,
      Time: recordDialogAiring.value.Time,
      Duration: recordDialogAiring.value.Duration,
      Channels: [recordDialogAiring.value.Channel],
      Airing: {
        Source: recordDialogAiring.value.Source || 'manual',
        Channel: recordDialogAiring.value.Channel,
        Time: recordDialogAiring.value.Time,
        Duration: recordDialogAiring.value.Duration,
        Title: recordDialogAiring.value.Title,
        Summary: recordDialogAiring.value.Summary,
        SeriesID: `manual/${recordDialogAiring.value.Title}`,
        Categories: recordDialogAiring.value.Categories || ['Show']
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
    emit('recording-created')
  } catch (e) {
    ElMessage.error(`Failed to create recording: ${e.message}`)
  }
}

function clearSearch() {
  searchQuery.value = ''
  searchResults.value = []
  searchError.value = ''
  hasSearched.value = false
}

// Initialize
loadChannels()
</script>

<style scoped>
.guide-search-container {
  margin-bottom: 32px;
  padding-bottom: 32px;
  border-bottom: 1px solid var(--color-background-mute);
  overflow-x: hidden;
}

:deep(.el-table) {
  background: var(--color-background) !important;
  color: var(--color-text) !important;
  overflow-x: auto;
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

:deep(.el-dialog) {
  background: var(--color-background, #222) !important;
  color: var(--color-text) !important;
  border-radius: 10px;
  box-shadow: 0 2px 16px 0 rgba(0,0,0,0.12);
}

:deep(.el-dialog__title) {
  color: var(--color-text) !important;
}
</style>

