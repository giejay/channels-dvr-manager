<template>
  <section class="schedule-container">
    <!-- Header -->
    <div class="header">
      <div class="header-left">
<!--        <ElInput-->
<!--          v-model="filter"-->
<!--          placeholder="Filter..."-->
<!--          clearable-->
<!--          class="filter-input"-->
<!--        />-->
      </div>
       <div class="header-right">
         <ElButton @click="toggleDarkMode" :type="isDark ? 'info' : 'default'" icon="Sun">
           {{ isDark ? '🌙 Dark' : '☀️ Light' }}
         </ElButton>
         <ElButton type="primary" class="create-recording-btn" @click="showManualDialog = true">
           Create manual recording
         </ElButton>
       </div>
    </div>

    <ElTabs v-model="activeTab" class="tabs-responsive">
      <!-- Schedule Tab -->
      <ElTabPane label="Scheduled Recordings" name="schedule">
        <div class="tab-content">
          <div v-if="selectedJobs.length" class="delete-selected-bar">
            <ElPopconfirm title="Delete all selected recordings?" @confirm="deleteSelectedJobs">
              <template #reference>
                <ElButton type="danger">
                  Delete Selected ({{ selectedJobs.length }})
                </ElButton>
              </template>
            </ElPopconfirm>
          </div>

          <!-- Desktop Table View -->
          <div class="table-wrapper desktop-view">
            <ElTable
              :data="filteredJobs"
              border
              stripe
              @selection-change="onSelectionChange"
              ref="tableRef"
            >
              <ElTableColumn type="selection" width="50" />
              <ElTableColumn prop="Name" label="Title" sortable min-width="150" />
              <ElTableColumn prop="Channels" label="Channels" :formatter="formatChannels" min-width="120" />
              <ElTableColumn prop="Time" label="Start" :formatter="row => formatDate(row.Time)" sortable min-width="160" />
              <ElTableColumn prop="Duration" label="Duration" :formatter="row => formatDuration(row.Duration)" sortable min-width="100" />
              <ElTableColumn label="Actions" width="140" fixed="right">
                <template #default="scope">
                  <ElPopconfirm title="Delete?" @confirm="deleteJob(scope.row.ID)">
                    <template #reference>
                      <ElButton type="danger" size="small" link>Delete</ElButton>
                    </template>
                  </ElPopconfirm>
                </template>
              </ElTableColumn>
            </ElTable>
          </div>

          <!-- Mobile Card View -->
          <div class="mobile-view">
            <div v-if="filteredJobs.length" class="card-list">
              <div v-for="job in filteredJobs" :key="job.ID" class="recording-card">
                <div class="card-header">
                  <h3 class="card-title">{{ job.Name }}</h3>
                  <ElPopconfirm title="Delete?" @confirm="deleteJob(job.ID)">
                    <template #reference>
                      <ElButton type="danger" size="small" link>Delete</ElButton>
                    </template>
                  </ElPopconfirm>
                </div>
                <div class="card-body">
                  <div class="card-row">
                    <span class="card-label">Channels:</span>
                    <span class="card-value">{{ formatChannels(job) }}</span>
                  </div>
                  <div class="card-row">
                    <span class="card-label">Start:</span>
                    <span class="card-value">{{ formatDate(job.Time) }}</span>
                  </div>
                  <div class="card-row">
                    <span class="card-label">Duration:</span>
                    <span class="card-value">{{ formatDuration(job.Duration) }}</span>
                  </div>
                </div>
              </div>
            </div>
            <div v-else-if="!loading && !error" class="empty-state">
              No recordings found
            </div>
          </div>

          <div v-if="loading" class="loading-state">Loading...</div>
          <div v-if="error" class="error-state">{{ error }}</div>
        </div>
      </ElTabPane>

      <!-- Search Tab -->
      <ElTabPane label="Guide" name="guide">
        <Guide />
      </ElTabPane>

      <!-- Recordings Tab -->
      <ElTabPane label="Recordings" name="recordings">
        <RecordingsTab />
      </ElTabPane>
    </ElTabs>

    <ElDialog
      v-model="showManualDialog"
      title="Create Manual Recording"
      class="manual-dialog"
      @close="resetManualForm"
    >
      <ManualRecording :visible="showManualDialog" @recording-created="onManualSaved" />
    </ElDialog>
  </section>
</template>

<script setup>
import { ref, onMounted, defineExpose, computed } from 'vue'
import ManualRecording from './ManualRecording.vue'
import Guide from './Guide.vue'
import RecordingsTab from './RecordingsTab.vue'
import { ElTable, ElTableColumn, ElInput, ElButton, ElPopconfirm, ElMessage, ElDialog, ElTabs, ElTabPane } from 'element-plus'

const jobs = ref([])
const channels = ref([])
const loading = ref(false)
const error = ref('')
const filter = ref('')
const showManualDialog = ref(false)
const isDark = ref(false)
const selectedJobs = ref([])
const activeTab = ref('schedule')

function formatDate(epoch) {
  const d = new Date(epoch * 1000)
  return d.toLocaleString()
}
function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return `${h}h ${m}m`
}

async function loadJobs() {
  loading.value = true
  error.value = ''
  try {
    const res = await fetch('/api/dvr/jobs')
    jobs.value = await res.json()
  } catch (e) {
    error.value = 'Failed to fetch jobs.'
  }
  loading.value = false
}

async function loadChannels() {
  try {
    const res = await fetch('/api/devices')
    const devices = await res.json()
    channels.value = devices.flatMap(dev => dev.Channels)
  } catch (e) {
    // fallback: empty
    channels.value = []
  }
}

async function deleteJob(id) {
  try {
    const res = await fetch(`/api/dvr/jobs/${id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error('Delete failed')
    ElMessage.success('Deleted!')
    await loadJobs()
  } catch (e) {
    ElMessage.error('Delete failed')
  }
}

async function deleteSelectedJobs() {
  try {
    for (const job of selectedJobs.value) {
      const res = await fetch(`/api/dvr/jobs/${job.ID}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
    }
    ElMessage.success('Deleted!')
    selectedJobs.value = []
    await loadJobs()
  } catch (e) {
    ElMessage.error('Delete failed')
  }
}

const filteredJobs = computed(() => {
  if (!filter.value) return jobs.value
  return jobs.value.filter(job =>
    job.Name.toLowerCase().includes(filter.value.toLowerCase()) ||
    job.Channels.join(',').includes(filter.value)
  )
})

onMounted(() => {
  // Load mode from localStorage if present
  isDark.value = localStorage.getItem('theme') === 'dark'
  applyTheme()
  loadChannels()
  loadJobs()
})

function toggleDarkMode() {
  isDark.value = !isDark.value
  localStorage.setItem('theme', isDark.value ? 'dark' : 'light')
  applyTheme()
}

function applyTheme() {
  const root = document.documentElement
  if (isDark.value) {
    root.classList.add('dark')
    root.style.setProperty('--color-background', '#181818')
    root.style.setProperty('--color-background-mute', '#232323')
    root.style.setProperty('--color-background-soft', '#222')
    root.style.setProperty('--color-text', '#f3f3f3')
  } else {
    root.classList.remove('dark')
    root.style.setProperty('--color-background', '#fff')
    root.style.setProperty('--color-background-mute', '#f5f5f5')
    root.style.setProperty('--color-background-soft', '#f0f0f0')
    root.style.setProperty('--color-text', '#222')
  }
}

defineExpose({ loadJobs })

function onManualSaved() {
  showManualDialog.value = false
  loadJobs()
}
function resetManualForm() {
  showManualDialog.value = false;
}
function onSelectionChange(selected) {
  selectedJobs.value = selected
}

function formatChannels(row) {
  if (!row.Channels || !Array.isArray(row.Channels)) return ''
  // Map channel IDs to GuideName using fetched channels
  const names = row.Channels.map(id => {
    const ch = channels.value.find(c => c.ID == id || c.GuideNumber == id)
    return ch ? `${ch.GuideNumber} - ${ch.GuideName}` : id
  })
  return names.join(', ')
}
</script>

<style scoped>
.schedule-container {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* Header Layout */
.header {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  align-items: stretch;
}

.header-left {
  flex: 1;
}

.header-right {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.filter-input {
  width: 100%;
}

:deep(.header-right .el-button) {
  color: var(--color-text) !important;
}


/* Desktop View */
@media (min-width: 768px) {
  .header {
    flex-direction: row;
    align-items: center;
  }

  .header-left {
    flex: 1;
  }

  .header-right {
    flex-wrap: nowrap;
  }

  .filter-input {
    width: 300px;
  }


  .desktop-view {
    display: block;
  }

  .mobile-view {
    display: none;
  }
}

/* Mobile Only */
@media (max-width: 767px) {
  .desktop-view {
    display: none;
  }

  .mobile-view {
    display: block;
  }

  .header-right :deep(.el-button) {
    flex: 1;
    min-width: 0;
  }
}

/* Table Wrapper */
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
  overflow: hidden;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: start;
  gap: 0.5rem;
  margin-bottom: 1rem;
  border-bottom: 1px solid var(--color-background-soft);
  padding-bottom: 0.5rem;
}

.card-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-text);
  flex: 1;
  word-break: break-word;
}

.card-body {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
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

/* States */
.delete-selected-bar {
  margin-top: 1rem;
  margin-bottom: 1rem;
  padding: 0.75rem;
  background: var(--color-background-soft);
  border-radius: 0.25rem;
}

.loading-state,
.empty-state,
.error-state {
  padding: 2rem 1rem;
  text-align: center;
  color: var(--color-text);
}

.error-state {
  color: #f56c6c;
}

/* Tabs */
:deep(.el-tabs) {
  --el-component-border-color: var(--color-background-soft);
}

:deep(.el-tabs__header) {
  background: var(--color-background);
  border-bottom: 1px solid var(--color-background-soft);
}

:deep(.el-tabs__nav-wrap) {
  background: var(--color-background);
}

:deep(.el-tabs__content) {
  color: var(--color-text);
}

:deep(.el-tabs__item) {
  color: var(--color-text) !important;
}

:deep(.el-tabs__item.is-active) {
  color: #409eff !important;
}

:deep(.el-tabs__item:hover) {
  color: var(--color-text) !important;
}

:deep(.el-tabs__item.is-top:hover) {
  color: var(--color-text) !important;
}

/* Dialog */
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

:deep(.el-button) {
  font-size: 0.95rem;
}

:deep(.schedule-container .el-button) {
  color: inherit !important;
}

:deep(.schedule-container .el-button span) {
  color: inherit !important;
}

:deep(.schedule-container .el-button--primary) {
  color: white !important;
}

:deep(.schedule-container .el-button--primary span) {
  color: white !important;
}

/* Ensure Create Recording button always has white text */
:deep(.create-recording-btn) {
  color: white !important;
}

:deep(.create-recording-btn span) {
  color: white !important;
}

/* Responsive dialog width */
@media (max-width: 600px) {
  :deep(.el-dialog) {
    width: 100% !important;
    margin: 0 !important;
  }

  :deep(.el-dialog__body) {
    padding: 1rem !important;
  }
}

@media (min-width: 601px) {
  :deep(.el-dialog.manual-dialog) {
    width: 600px !important;
  }
}
</style>
