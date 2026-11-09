<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { itemApi, serverApi } from '../api/basic'
import { assetUrl } from '../utils/asset'
import { fmtWan } from '../utils/format'
import type { GameItemDTO, GameServerDTO, ItemCategory, ItemPriceDTO } from '@lc/shared'

/**
 * 基础数据：物品 + 三档价格。
 * 固定价格物品按「物品 × 服务器」维护；非固定价格物品只在记账时现填单价。
 */

const CATEGORY_LABEL: Record<ItemCategory, string> = {
  EQUIP: '装备',
  BEAST_SKILL: '兽决',
  FIVE_TREASURE: '五宝',
  GEM: '宝石',
  WEAPON: '武器',
  OTHER: '其他'
}
const CATEGORY_OPTIONS = Object.entries(CATEGORY_LABEL).map(([value, label]) => ({ value, label }))

const servers = ref<GameServerDTO[]>([])
const serverId = ref<number | null>(null)

const list = ref<GameItemDTO[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = 60
const keyword = ref('')
const category = ref('')
const loading = ref(false)

/** itemId → 该服价格 */
const prices = ref<Map<number, ItemPriceDTO>>(new Map())

const serverName = computed(() => servers.value.find((s) => s.id === serverId.value)?.name ?? '')

async function loadServers() {
  const { data } = await serverApi.list()
  servers.value = data.data.list
  if (!serverId.value) serverId.value = servers.value[0]?.id ?? null
}

async function loadList() {
  loading.value = true
  try {
    const { data } = await itemApi.list({
      page: page.value,
      pageSize,
      keyword: keyword.value.trim() || undefined,
      category: category.value || undefined,
      sort: 'NAME',
      serverId: serverId.value ?? undefined
    })
    list.value = data.data.list
    total.value = data.data.total
  } finally {
    loading.value = false
  }
}

async function loadPrices() {
  if (!serverId.value) {
    prices.value = new Map()
    return
  }
  const { data } = await itemApi.pricesOfServer(serverId.value)
  prices.value = new Map(data.data.map((p) => [p.itemId, p]))
}

async function reload() {
  await Promise.all([loadList(), loadPrices()])
}

watch(serverId, () => void reload())
watch(category, () => {
  page.value = 1
  void loadList()
})

/* ---------------- 物品编辑 ---------------- */

const itemDialog = reactive({
  visible: false,
  id: 0,
  name: '',
  pinyin: '',
  category: 'OTHER' as ItemCategory,
  level: '',
  isFixedPrice: false,
  isCommon: false
})

function openCreate() {
  Object.assign(itemDialog, {
    visible: true,
    id: 0,
    name: '',
    pinyin: '',
    category: 'OTHER',
    level: '',
    isFixedPrice: false,
    isCommon: false
  })
}

function openEdit(row: GameItemDTO) {
  Object.assign(itemDialog, {
    visible: true,
    id: row.id,
    name: row.name,
    pinyin: row.pinyin,
    category: row.category,
    level: row.level ?? '',
    isFixedPrice: row.isFixedPrice,
    isCommon: row.isCommon
  })
}

async function saveItem() {
  const name = itemDialog.name.trim()
  if (!name) return ElMessage.warning('物品名不能为空')
  const body = {
    name,
    pinyin: itemDialog.pinyin.trim() || name,
    category: itemDialog.category,
    level: itemDialog.level.trim(),
    isFixedPrice: itemDialog.isFixedPrice,
    isCommon: itemDialog.isCommon
  }
  try {
    if (itemDialog.id) await itemApi.update(itemDialog.id, body)
    else await itemApi.create(body)
    itemDialog.visible = false
    await reload()
    ElMessage.success('已保存')
  } catch (e) {
    ElMessage.error((e as Error).message)
  }
}

async function disableItem(row: GameItemDTO) {
  try {
    await ElMessageBox.confirm(
      `停用后「${row.name}」不再出现在记账候选里，历史记录保留。`,
      '停用物品',
      { confirmButtonText: '停用', cancelButtonText: '取消', type: 'warning' }
    )
  } catch {
    return
  }
  try {
    await itemApi.disable(row.id)
    await reload()
  } catch (e) {
    ElMessage.error((e as Error).message)
  }
}

/* ---------------- 图标 ---------------- */

const fileInput = ref<HTMLInputElement | null>(null)
let uploadTarget: GameItemDTO | null = null

function pickIcon(row: GameItemDTO) {
  uploadTarget = row
  fileInput.value?.click()
}

async function onIconPicked(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file || !uploadTarget) return
  if (file.size > 2 * 1024 * 1024) return ElMessage.warning('图片不能超过 2MB')
  const dataUrl = await readAsDataUrl(file)
  try {
    await itemApi.uploadIcon(uploadTarget.id, dataUrl)
    await loadList()
    ElMessage.success('图标已更新')
  } catch (err) {
    ElMessage.error((err as Error).message)
  }
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

/* ---------------- 三档价格 ---------------- */

const priceDialog = reactive({
  visible: false,
  item: null as GameItemDTO | null,
  merchantPrice: 0,
  personalPrice: 0,
  userPrice: 0
})

function openPrice(row: GameItemDTO) {
  if (!serverId.value) return ElMessage.warning('先添加服务器')
  const p = prices.value.get(row.id)
  Object.assign(priceDialog, {
    visible: true,
    item: row,
    merchantPrice: p?.merchantPrice ?? 0,
    personalPrice: p?.personalPrice ?? 0,
    userPrice: p?.userPrice ?? 0
  })
}

async function savePrice() {
  if (!priceDialog.item || !serverId.value) return
  if (!priceDialog.userPrice || priceDialog.userPrice <= 0) {
    return ElMessage.warning('用户录入价必填，且要大于 0')
  }
  try {
    await itemApi.setPrice(priceDialog.item.id, serverId.value, {
      merchantPrice: priceDialog.merchantPrice || null,
      personalPrice: priceDialog.personalPrice || null,
      userPrice: Math.round(priceDialog.userPrice)
    })
    priceDialog.visible = false
    await loadPrices()
    ElMessage.success('价格已保存')
  } catch (e) {
    ElMessage.error((e as Error).message)
  }
}

function priceText(v: number | null | undefined): string {
  return v ? `${fmtWan(v)} 万` : '—'
}

onMounted(async () => {
  await loadServers()
  await reload()
})
</script>

<template>
  <div class="items">
    <header class="page-head">
      <div>
        <h2>物品信息</h2>
        <p class="sub">固定价格物品在这里按服务器维护三档价；点卡价在设置里改。</p>
      </div>
      <div class="head-actions">
        <el-select v-model="serverId" placeholder="选择服务器" style="width: 160px">
          <el-option v-for="s in servers" :key="s.id" :label="s.name" :value="s.id" />
        </el-select>
        <el-button type="primary" @click="openCreate">新增物品</el-button>
      </div>
    </header>

    <div class="toolbar">
      <el-input
        v-model="keyword"
        placeholder="搜物品名 / 拼音"
        clearable
        style="width: 240px"
        @keyup.enter="((page = 1), reload())"
        @clear="((page = 1), reload())"
      />
      <el-select v-model="category" placeholder="全部分类" clearable style="width: 140px">
        <el-option v-for="c in CATEGORY_OPTIONS" :key="c.value" :label="c.label" :value="c.value" />
      </el-select>
      <el-button @click="((page = 1), reload())">查询</el-button>
      <span class="count">共 {{ total }} 件</span>
    </div>

    <el-table v-loading="loading" :data="list" height="calc(100vh - 275px)" class="tbl">
      <el-table-column label="图标" width="64">
        <template #default="{ row }">
          <img v-if="row.iconUrl" :src="assetUrl(row.iconUrl)!" class="icon" alt="" />
          <div v-else class="icon placeholder">{{ row.name.slice(0, 1) }}</div>
        </template>
      </el-table-column>
      <el-table-column prop="name" label="物品名" min-width="150" />
      <el-table-column label="分类" width="90">
        <template #default="{ row }">{{ CATEGORY_LABEL[row.category as ItemCategory] }}</template>
      </el-table-column>
      <el-table-column label="价格类型" width="110">
        <template #default="{ row }">
          <el-tag :type="row.isFixedPrice ? 'success' : 'info'" size="small" effect="plain">
            {{ row.isFixedPrice ? '固定价格' : '按次录入' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="商人收购" width="110" align="right">
        <template #default="{ row }">
          {{ row.isFixedPrice ? priceText(prices.get(row.id)?.merchantPrice) : '—' }}
        </template>
      </el-table-column>
      <el-table-column label="个人收购" width="110" align="right">
        <template #default="{ row }">
          {{ row.isFixedPrice ? priceText(prices.get(row.id)?.personalPrice) : '—' }}
        </template>
      </el-table-column>
      <el-table-column label="用户录入价" width="110" align="right">
        <template #default="{ row }">
          <span :class="{ missing: row.isFixedPrice && !prices.get(row.id)?.userPrice }">
            {{ row.isFixedPrice ? priceText(prices.get(row.id)?.userPrice) : '—' }}
          </span>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="220" fixed="right">
        <template #default="{ row }">
          <el-button
            v-if="row.isFixedPrice"
            link
            type="primary"
            @click="openPrice(row)"
          >
            维护价格
          </el-button>
          <el-button link @click="openEdit(row)">编辑</el-button>
          <el-button link @click="pickIcon(row)">换图标</el-button>
          <el-button v-if="row.status === 'ENABLED'" link type="danger" @click="disableItem(row)">停用</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-pagination
      v-model:current-page="page"
      :page-size="pageSize"
      :total="total"
      layout="prev, pager, next"
      class="pager"
      @current-change="loadList"
    />

    <input ref="fileInput" type="file" accept="image/png,image/jpeg,image/webp" hidden @change="onIconPicked" />

    <!-- 新增 / 编辑物品 -->
    <el-dialog v-model="itemDialog.visible" :title="itemDialog.id ? '编辑物品' : '新增物品'" width="440px">
      <el-form label-width="88px">
        <el-form-item label="物品名" required>
          <el-input v-model="itemDialog.name" maxlength="40" />
        </el-form-item>
        <el-form-item label="拼音">
          <el-input v-model="itemDialog.pinyin" placeholder="用于快捷搜索，可留空" maxlength="40" />
        </el-form-item>
        <el-form-item label="分类">
          <el-select v-model="itemDialog.category" style="width: 100%">
            <el-option v-for="c in CATEGORY_OPTIONS" :key="c.value" :label="c.label" :value="c.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="等级">
          <el-input v-model="itemDialog.level" placeholder="例如 175，可留空" maxlength="20" />
        </el-form-item>
        <el-form-item label="固定价格">
          <el-switch v-model="itemDialog.isFixedPrice" />
          <span class="tip">开了才需要维护三档价</span>
        </el-form-item>
        <el-form-item label="常用">
          <el-switch v-model="itemDialog.isCommon" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="itemDialog.visible = false">取消</el-button>
        <el-button type="primary" @click="saveItem">保存</el-button>
      </template>
    </el-dialog>

    <!-- 三档价格 -->
    <el-dialog v-model="priceDialog.visible" title="维护价格" width="440px">
      <p class="price-head">
        {{ priceDialog.item?.name }} · {{ serverName }}
        <span class="tip">商人收购价 ≤ 个人收购价 ≤ 用户录入价</span>
      </p>
      <el-form label-width="100px">
        <el-form-item label="商人收购价">
          <el-input-number v-model="priceDialog.merchantPrice" :min="0" :step="1000" :precision="0" controls-position="right" style="width: 100%" />
        </el-form-item>
        <el-form-item label="个人收购价">
          <el-input-number v-model="priceDialog.personalPrice" :min="0" :step="1000" :precision="0" controls-position="right" style="width: 100%" />
        </el-form-item>
        <el-form-item label="用户录入价" required>
          <el-input-number v-model="priceDialog.userPrice" :min="1" :step="1000" :precision="0" controls-position="right" style="width: 100%" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="priceDialog.visible = false">取消</el-button>
        <el-button type="primary" @click="savePrice">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.items {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.page-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}
h2 {
  margin: 0;
  font-size: 20px;
}
.sub {
  margin: 4px 0 0;
  color: var(--text-muted);
  font-size: 13px;
}
.head-actions {
  display: flex;
  gap: 10px;
}
.toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
}
.count {
  margin-left: auto;
  color: var(--text-muted);
  font-size: 13px;
}
.tbl {
  background: var(--bg-card);
  border-radius: var(--radius-card);
}
.icon {
  width: 34px;
  height: 34px;
  border-radius: 8px;
  object-fit: cover;
  border: 1px solid var(--border);
  display: block;
}
.placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  font-size: 13px;
  background: var(--bg-raised);
}
.missing {
  color: var(--warning);
}
.tip {
  margin-left: 8px;
  color: var(--text-muted);
  font-size: 12px;
}
.price-head {
  margin: 0 0 14px;
  font-weight: 600;
}
.price-head .tip {
  display: block;
  margin: 4px 0 0;
  font-weight: 400;
}
.pager {
  justify-content: flex-end;
}
</style>
