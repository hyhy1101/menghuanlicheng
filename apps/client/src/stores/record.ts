import { defineStore } from 'pinia'
import { sessionApi, emptyTotals } from '../api/session'
import type { SessionState } from '../api/session'
import type { MileageSessionDTO, TotalsDTO } from '@lc/shared'

/*
 * 并发记账：一个号组一条会话，所以 store 持有的是**列表**，外加一个 currentId。
 *
 * 关键设计：session 不是 state，而是由 sessions + currentId 派生的 getter。
 * 这样页面里原本几十处 `store.session` / `store.totals` 的读法一行都不用改，
 * 它们自然只看到"当前选中的那一条"；切号组只是换 currentId。
 */
interface RecordState extends Omit<SessionState, 'session'> {
  /** 全部进行中的会话（按开始时间升序，与 GET /active 一致） */
  sessions: MileageSessionDTO[]
  /** 当前正在操作的那一条；null = 没选中 */
  currentId: number | null
  shareText: string
  lastSummary: { durationMinutes: number; totalIncome: number; netIncome: number; netEfficiency: number } | null
}

/** 从会话 DTO 里摘出汇总字段，作为实时汇总的初值 */
function totalsOf(s: MileageSessionDTO): TotalsDTO {
  return {
    itemSum: s.itemSum,
    totalSilver: s.totalSilver,
    totalIncome: s.totalIncome,
    cardCost: s.cardCost,
    cardPrice: s.cardPrice,
    lossTotal: s.lossTotal,
    netIncome: s.netIncome,
    netEfficiency: s.netEfficiency
  }
}

/** 汇总写回会话对象，切走再切回来不会看到旧数字 */
function assignTotals(s: MileageSessionDTO, t: TotalsDTO) {
  s.itemSum = t.itemSum
  s.totalSilver = t.totalSilver
  s.totalIncome = t.totalIncome
  s.cardCost = t.cardCost
  s.cardPrice = t.cardPrice
  s.lossTotal = t.lossTotal
  s.netIncome = t.netIncome
  s.netEfficiency = t.netEfficiency
}

export const useRecordStore = defineStore('record', {
  state: (): RecordState => ({
    sessions: [],
    currentId: null,
    totals: emptyTotals(),
    paused: false,
    shareText: '',
    lastSummary: null
  }),
  getters: {
    /** 当前会话。原先读 store.session 的地方全部照旧 */
    session(state): MileageSessionDTO | null {
      return state.sessions.find((s) => s.id === state.currentId) ?? null
    },
    /** 是否**有任何**号组在记（顶部提示、更新 hold 用它） */
    isRecording(state): boolean {
      return state.sessions.length > 0
    },
    /** 并发条数，界面上显示"进行中 N 条" */
    activeCount(state): number {
      return state.sessions.length
    },
    elapsedSeconds(): number {
      const s = this.session
      if (!s) return 0
      return Math.floor((Date.now() - new Date(s.startTime.replace(' ', 'T')).getTime()) / 1000)
    }
  },
  actions: {
    /** 切换当前操作的号组 */
    select(id: number) {
      if (this.currentId === id) return
      this.currentId = id
      this.paused = false
      const s = this.sessions.find((x) => x.id === id)
      this.totals = s ? totalsOf(s) : emptyTotals()
    },

    /**
     * 传入 DTO：覆盖/追加并选中它（开始里程、切活动、取回最新状态都走这里）
     * 传入 null：把**当前**这条移出列表并顺延到下一条（结束或放弃之后）
     */
    applySession(session: MileageSessionDTO | null) {
      if (session) {
        const i = this.sessions.findIndex((x) => x.id === session.id)
        if (i >= 0) this.sessions[i] = session
        else this.sessions.push(session)
        this.currentId = session.id
        this.totals = totalsOf(session)
      } else {
        if (this.currentId != null) {
          this.sessions = this.sessions.filter((x) => x.id !== this.currentId)
        }
        const next = this.sessions[0] ?? null
        this.currentId = next?.id ?? null
        this.totals = next ? totalsOf(next) : emptyTotals()
      }
      this.paused = false
    },

    /** 崩溃恢复：服务端返回全部进行中的会话 */
    async restore() {
      const { data } = await sessionApi.active()
      const list = (data.data as { sessions?: MileageSessionDTO[] }).sessions ?? []
      this.sessions = list
      // 保留当前选中项；它已不在列表里（刚结束）或首次加载时退回到第一条
      if (!list.some((s) => s.id === this.currentId)) this.currentId = list[0]?.id ?? null
      const cur = list.find((s) => s.id === this.currentId) ?? null
      this.totals = cur ? totalsOf(cur) : emptyTotals()
      this.paused = false
    },

    applyTotals(t: TotalsDTO) {
      this.totals = t
      const cur = this.sessions.find((s) => s.id === this.currentId)
      if (cur) assignTotals(cur, t)
    },

    setPaused(p: boolean) {
      this.paused = p
    },

    setShare(text: string, summary: RecordState['lastSummary']) {
      this.shareText = text
      this.lastSummary = summary
    },

    async discard() {
      if (this.session) await sessionApi.discard(this.session.id)
      this.applySession(null)
    }
  }
})
