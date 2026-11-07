/**
 * Minimal, dependency-free i18n for the LocalReel web UI.
 *
 * Two flat dictionaries share one key set (enforced by TypeScript and by
 * i18n.test.ts), so adding a string cannot silently ship in only one language.
 * Language resolution order: localStorage("localreel.lang") -> navigator.language
 * (anything starting with "zh" means Chinese, everything else English).
 */
import { useCallback, useEffect, useState } from 'react'

export type Lang = 'zh' | 'en'

export const LANG_STORAGE_KEY = 'localreel.lang'
export const SUPPORTED_LANGS: readonly Lang[] = ['zh', 'en'] as const

export type TranslationVars = Record<string, string | number>

const en = {
  // Language switch
  'lang.label': 'Language',
  'lang.zh': '中文',
  'lang.en': 'EN',

  // Navigation shared by the three pages
  'nav.library': 'Library',
  'nav.reels': 'Reels',
  'nav.admin': 'Admin →',
  'nav.library.back': '← Library',

  // Mobile bottom navigation
  'nav.bottom': 'Main navigation',
  'nav.tab.library': 'Library',
  'nav.tab.reels': 'Reels',
  'nav.tab.admin': 'Admin',

  // Values shared by more than one page
  'common.unknownCodec': 'unknown',
  'common.missing': 'missing',
  'error.detail': 'Details',

  // Library
  'library.kicker': 'Local-first media',
  'library.count.one': '{count} item',
  'library.count.other': '{count} items',
  'library.controls': 'Library controls',
  'library.search': 'Search title, filename or path',
  'library.filters': 'Filters',
  'library.filter.all': 'All',
  'library.filter.continue': 'Continue',
  'library.filter.favorites': 'Favorites',
  'library.filter.archived': 'Archived',
  'library.filter.archived.title': 'Include media from archived sources',
  'library.loading': 'Loading library…',
  'library.empty.prefix': 'No media yet. Add a folder in ',
  'library.empty.suffix': ' and run a scan.',
  'library.loadMore': 'Load more',
  'library.loadingMore': 'Loading…',

  // Player overlay / playback status
  'player.close': 'Close player',
  'player.preparing': 'Preparing playback…',
  'player.transcoding': 'transcoding',
  'player.unable': 'Unable to play this file.',
  'player.hls': 'HLS',
  'player.hlsHint': 'Play through an HLS playlist',
  'player.hlsUnsupported': 'This browser cannot play HLS.',

  // Reels
  'reels.loading': 'Loading reels…',
  'reels.empty': 'No media yet. Scan a source first.',
  'reels.kicker': 'Reel · {duration}',
  'reels.playing': 'playing',
  'reels.unmute': 'Unmute',
  'reels.mute': 'Mute',
  'reels.episode': 'Episode {episode}',
  'reels.seen': 'Resume at {time}',
  'reels.like': 'Like',
  'reels.liked': 'Liked',
  'reels.favorite': 'Favorite',
  'reels.favorited': 'Favorited',
  'reels.progress': 'Playback progress',
  'reels.seriesFinished': 'Series finished',
  'reels.replay': 'Replay',
  'reels.retry': 'Retry',
  'reels.error.title': 'Unable to play this file',
  'reels.error.body': 'The file may be missing or transcoding failed.',
  'reels.transcoding': 'Transcoding this file…',
  'reels.fullscreen': 'Full screen',
  'reels.loadingNext': 'Loading the next episode…',
  'reels.nextFailed': 'Could not load the next episode.',

  // Admin: header, health and status values
  'admin.kicker': 'Operations',
  'admin.title': 'Admin',
  'admin.loading': 'Loading diagnostics…',
  'admin.diagnostics': 'Diagnostics',
  'admin.status': 'Status',
  'admin.stat.database': 'Database',
  'admin.stat.ffmpeg': 'ffmpeg',
  'admin.stat.media': 'Media',
  'admin.stat.watch': 'Auto watch',
  'admin.status.connected': 'connected',
  'admin.status.unavailable': 'unavailable',
  'admin.status.available': 'available',
  'admin.healthStatus.ok': 'ok',
  'admin.jobStatus.queued': 'queued',
  'admin.jobStatus.running': 'running',
  'admin.jobStatus.succeeded': 'succeeded',
  'admin.jobStatus.failed': 'failed',
  'admin.jobStatus.canceled': 'canceled',

  // Admin: sources table and actions
  'admin.sources.title': 'Sources',
  'admin.refresh': 'Refresh',
  'admin.sources.empty': 'No folders yet.',
  'admin.table.uri': 'URI',
  'admin.table.kind': 'Kind',
  'admin.table.enabled': 'Enabled',
  'admin.value.archived': 'archived',
  'admin.value.yes': 'yes',
  'admin.value.no': 'no',
  'admin.action.restore': 'Restore',
  'admin.action.remap': 'Remap',
  'admin.action.delete': 'Delete',
  'admin.action.deleting': 'Deleting…',
  'admin.action.disable': 'Disable',
  'admin.action.enable': 'Enable',
  'admin.action.archive': 'Archive',
  'admin.action.scan': 'Scan',
  'admin.action.queueing': 'Queueing…',
  'admin.action.preview': 'Preview',
  'admin.action.checking': 'Checking…',
  'admin.action.apply': 'Apply',
  'admin.action.cancel': 'Cancel',
  'admin.action.import': 'Import',
  'admin.action.working': 'Working…',

  // Admin: remap form and confirmations
  'admin.remap.prefix': 'Remap ',
  'admin.remap.suffix': ' to a new local directory:',
  'admin.remap.placeholder': 'New local directory',
  'admin.remap.report': 'remapped {remapped} · missing {missing} · skipped {skipped}',
  'admin.remap.confirm':
    'Remap source?\n\n{remapped} media will move, {missing} missing, {skipped} skipped.',
  'admin.remap.done': 'Remapped source: {remapped} media, {missing} missing.',

  // Admin: cache
  'admin.cache.title': 'Cache',
  'admin.cache.run': 'Run GC',
  'admin.cache.running': 'Running…',
  'admin.cache.total': 'Total',
  'admin.cache.transcodes': 'Transcodes',
  'admin.cache.thumbnails': 'Thumbnails',
  'admin.cache.unavailable': 'Cache stats unavailable.',
  'admin.cache.gcDone': 'Removed {removed} variant(s), freed {freed}; {kept} kept.',
  'admin.cache.lastJob': 'Last GC job: {status}',
  'admin.cache.gcSummary': 'removed {removed}, freed {freed}, kept {kept}',

  // Admin: backup
  'admin.backup.title': 'Backup',
  'admin.backup.export': 'Export JSON',
  'admin.backup.help':
    'Import merges liked/favorite flags and never lowers existing progress. Restore is the one-step path for a fresh data dir: import, scan/probe/thumbnail, replay states.',
  'admin.backup.restoreTitle': 'Import, scan/probe/thumbnail, then replay states',
  'admin.backup.report':
    'Sources +{sources} · states imported {imported} · unchanged {unchanged} · missing {missing}',
  'admin.backup.warnings': 'warnings {count}',
  'admin.backup.import.confirm':
    'Import backup?\n\nSources: {sources}\nStates: {states}\nMissing states: {missing}\n\nExisting progress is never lowered.',
  'admin.backup.restore.confirm':
    'Restore this backup?\n\nThis imports sources, scans/probes/thumbnails them, and replays states. It does not overwrite existing progress.',
  'admin.backup.restore.queued': 'Restore job queued: {jobId}',

  // Admin: jobs
  'admin.jobs.title': 'Recent jobs',
  'admin.jobs.empty': 'No jobs yet.',
  'admin.table.progress': 'Progress',
  'admin.table.attempts': 'Attempts',
  'admin.table.error': 'Error',

  // Admin: scan history
  'admin.scans.title': 'Scan history',
  'admin.scans.empty': 'No scans yet.',
  'admin.table.source': 'Source',
  'admin.table.discovered': 'Discovered',
  'admin.table.added': 'Added',
  'admin.table.updated': 'Updated',
  'admin.table.missing': 'Missing',
  'admin.table.failed': 'Failed',

  // Admin: paths
  'admin.paths.title': 'Paths',
  'admin.paths.data': 'Data',
  'admin.paths.thumbnails': 'Thumbnails',
  'admin.paths.transcodes': 'Transcodes',
  'admin.paths.version': 'Version',
  'admin.paths.watch': 'Watchers',
  'admin.watch.active': '{count} watching',
  'admin.watch.disabled': 'off',
  'admin.watch.skipped': 'Not watched',

  // Admin: destructive source removal
  'admin.remove.confirm':
    'Remove source {uri}?\n\n{detail}\n\nThis deletes the source, media metadata, state and generated artifacts.',
  'admin.remove.detail': '{media} media items, {states} states, {variants} artifacts',
  'admin.remove.done': 'Removed source: {media} media, {states} states, {files} files.',
  // Accounts: first run, sign-in and the session menu
  'auth.loading': 'Checking your session...',
  'auth.kicker': 'Private by design',
  'auth.setup.title': 'Set up LocalReel',
  'auth.setup.subtitle':
    'Choose the owner account. It can manage every other account.',
  'auth.signIn.title': 'Sign in',
  'auth.signIn.subtitle': 'This library is private. Sign in to continue.',
  'auth.field.username': 'Username',
  'auth.field.password': 'Password',
  'auth.field.confirm': 'Confirm password',
  'auth.hint.password': 'At least 8 characters.',
  'auth.action.signIn': 'Sign in',
  'auth.action.setup': 'Create owner account',
  'auth.action.working': 'Working...',
  'auth.error.mismatch': 'The passwords do not match.',
  'auth.error.failed': 'Could not sign in: {message}',
  'auth.error.setup': 'Could not create the account: {message}',

  // Accounts: session and administration
  'admin.signedInAs': 'Signed in as {username}',
  'admin.action.signOut': 'Sign out',
  'admin.addSource.title': 'Add a folder',
  'admin.addSource.hint':
    'A folder on the machine running LocalReel. The server process must be able to read it.',
  'admin.addSource.placeholder': 'D:\\Media or /volume1/media',
  'admin.addSource.kind': 'Kind',
  'admin.addSource.kindHint': 'optional',
  'admin.addSource.submit': 'Add and scan',
  'admin.addSource.working': 'Adding...',
  'admin.addSource.done': 'Added {uri}; the scan is queued.',
  'admin.addSource.error': 'Could not add the folder: {message}',
  'admin.users.title': 'Accounts',
  'admin.users.subtitle':
    'Everyone in the household gets their own watch progress.',
  'admin.users.empty': 'Only the owner account exists.',
  'admin.users.username': 'Username',
  'admin.users.password': 'Password',
  'admin.users.role': 'Role',
  'admin.users.roleAdmin': 'Administrator',
  'admin.users.roleUser': 'Viewer',
  'admin.users.create': 'Create account',
  'admin.users.creating': 'Creating...',
  'admin.users.enable': 'Enable',
  'admin.users.disable': 'Disable',
  'admin.users.delete': 'Delete',
  'admin.users.reset': 'Reset password',
  'admin.users.resetPrompt': 'New password for {username} (at least 8 characters)',
  'admin.users.deleteConfirm':
    'Delete the account {username}? Its watch progress is removed.',
  'admin.users.self': 'you',
  'admin.users.lastLogin': 'Last sign-in',
  'admin.users.never': 'never',
  'admin.users.created': 'Created the account {username}.',
  'admin.users.failed': 'Could not change the account: {message}',
  'admin.shutdown.title': 'Server',
  'admin.shutdown.help':
    'Stop the running LocalReel process. On a platform without a tray icon this is how the app exits; playing videos and running jobs are interrupted.',
  'admin.shutdown.action': 'Shut down server',
  'admin.shutdown.busy': 'Stopping…',
  'admin.shutdown.confirm':
    'Shut down LocalReel? Playback and running jobs stop immediately.',
  'admin.shutdown.done': 'The server has stopped. You can close this page.',
  'admin.ffmpeg.hint':
    'ffmpeg was not found: metadata, thumbnails and transcoding are disabled. Install ffmpeg, place it in ffmpeg/bin next to the program, or set LOCALREEL_FFMPEG.',
  'admin.backup.usersCreated':
    '{count} restored account(s) have no password yet; set one in Accounts.',
} as const

export type TranslationKey = keyof typeof en

const zh: Record<TranslationKey, string> = {
  // Language switch
  'lang.label': '语言',
  'lang.zh': '中文',
  'lang.en': 'EN',

  // Navigation shared by the three pages
  'nav.library': '媒体库',
  'nav.reels': '短视频',
  'nav.admin': '管理 →',
  'nav.library.back': '← 媒体库',

  // Mobile bottom navigation
  'nav.bottom': '主导航',
  'nav.tab.library': '媒体库',
  'nav.tab.reels': '短视频',
  'nav.tab.admin': '管理',

  // Values shared by more than one page
  'common.unknownCodec': '未知',
  'common.missing': '缺失',
  'error.detail': '详情',

  // Library
  'library.kicker': '本地优先的媒体库',
  'library.count.one': '{count} 个条目',
  'library.count.other': '{count} 个条目',
  'library.controls': '媒体库控件',
  'library.search': '搜索标题、文件名或路径',
  'library.filters': '筛选',
  'library.filter.all': '全部',
  'library.filter.continue': '继续观看',
  'library.filter.favorites': '收藏',
  'library.filter.archived': '已归档',
  'library.filter.archived.title': '包含来自已归档来源的媒体',
  'library.loading': '正在加载媒体库…',
  'library.empty.prefix': '还没有媒体。请在 ',
  'library.empty.suffix': ' 添加媒体目录并运行扫描。',
  'library.loadMore': '加载更多',
  'library.loadingMore': '加载中…',

  // Player overlay / playback status
  'player.close': '关闭播放器',
  'player.preparing': '正在准备播放…',
  'player.transcoding': '转码中',
  'player.unable': '无法播放此文件。',
  'player.hls': 'HLS',
  'player.hlsHint': '通过 HLS 播放列表播放',
  'player.hlsUnsupported': '此浏览器无法播放 HLS。',

  // Reels
  'reels.loading': '正在加载短视频…',
  'reels.empty': '还没有媒体。请先扫描一个来源。',
  'reels.kicker': '短视频 · {duration}',
  'reels.playing': '播放中',
  'reels.unmute': '取消静音',
  'reels.mute': '静音',
  'reels.episode': '第 {episode} 集',
  'reels.seen': '看到 {time}',
  'reels.like': '喜欢',
  'reels.liked': '已喜欢',
  'reels.favorite': '收藏',
  'reels.favorited': '已收藏',
  'reels.progress': '播放进度',
  'reels.seriesFinished': '本系列已看完',
  'reels.replay': '重播',
  'reels.retry': '重试',
  'reels.error.title': '无法播放此文件',
  'reels.error.body': '文件可能缺失，或转码失败。',
  'reels.transcoding': '正在转码此文件…',
  'reels.fullscreen': '全屏观看',
  'reels.loadingNext': '正在加载下一集…',
  'reels.nextFailed': '无法加载下一集。',

  // Admin: header, health and status values
  'admin.kicker': '运维',
  'admin.title': '管理',
  'admin.loading': '正在加载诊断信息…',
  'admin.diagnostics': '诊断',
  'admin.status': '状态',
  'admin.stat.database': '数据库',
  'admin.stat.ffmpeg': 'ffmpeg',
  'admin.stat.media': '媒体',
  'admin.stat.watch': '自动监听',
  'admin.status.connected': '已连接',
  'admin.status.unavailable': '不可用',
  'admin.status.available': '可用',
  'admin.healthStatus.ok': '正常',
  'admin.jobStatus.queued': '排队中',
  'admin.jobStatus.running': '运行中',
  'admin.jobStatus.succeeded': '成功',
  'admin.jobStatus.failed': '失败',
  'admin.jobStatus.canceled': '已取消',

  // Admin: sources table and actions
  'admin.sources.title': '来源',
  'admin.refresh': '刷新',
  'admin.sources.empty': '还没有媒体目录。',
  'admin.table.uri': 'URI',
  'admin.table.kind': '类型',
  'admin.table.enabled': '启用',
  'admin.value.archived': '已归档',
  'admin.value.yes': '是',
  'admin.value.no': '否',
  'admin.action.restore': '恢复',
  'admin.action.remap': '重新映射',
  'admin.action.delete': '删除',
  'admin.action.deleting': '正在删除…',
  'admin.action.disable': '停用',
  'admin.action.enable': '启用',
  'admin.action.archive': '归档',
  'admin.action.scan': '扫描',
  'admin.action.queueing': '正在排队…',
  'admin.action.preview': '预览',
  'admin.action.checking': '检查中…',
  'admin.action.apply': '应用',
  'admin.action.cancel': '取消',
  'admin.action.import': '导入',
  'admin.action.working': '处理中…',

  // Admin: remap form and confirmations
  'admin.remap.prefix': '将 ',
  'admin.remap.suffix': ' 重新映射到新的本地目录：',
  'admin.remap.placeholder': '新的本地目录',
  'admin.remap.report': '已映射 {remapped} · 缺失 {missing} · 跳过 {skipped}',
  'admin.remap.confirm':
    '重新映射来源？\n\n{remapped} 个媒体将被移动，{missing} 个缺失，{skipped} 个跳过。',
  'admin.remap.done': '已重新映射来源：{remapped} 个媒体，{missing} 个缺失。',

  // Admin: cache
  'admin.cache.title': '缓存',
  'admin.cache.run': '运行清理',
  'admin.cache.running': '运行中…',
  'admin.cache.total': '总计',
  'admin.cache.transcodes': '转码文件',
  'admin.cache.thumbnails': '缩略图',
  'admin.cache.unavailable': '暂无缓存统计。',
  'admin.cache.gcDone': '已删除 {removed} 个转码文件，释放 {freed}；保留 {kept} 个。',
  'admin.cache.lastJob': '上次清理任务：{status}',
  'admin.cache.gcSummary': '已删除 {removed}，释放 {freed}，保留 {kept}',

  // Admin: backup
  'admin.backup.title': '备份',
  'admin.backup.export': '导出 JSON',
  'admin.backup.help':
    '导入会合并喜欢/收藏标记，且不会降低已有进度。恢复适合全新的数据目录：一步完成导入、扫描/探测/生成缩略图并回放状态。',
  'admin.backup.restoreTitle': '导入、扫描/探测/生成缩略图，然后回放状态',
  'admin.backup.report':
    '来源 +{sources} · 已导入状态 {imported} · 未变 {unchanged} · 缺失 {missing}',
  'admin.backup.warnings': '警告 {count}',
  'admin.backup.import.confirm':
    '导入备份？\n\n来源：{sources}\n状态：{states}\n缺失状态：{missing}\n\n已有进度不会被降低。',
  'admin.backup.restore.confirm':
    '恢复这个备份？\n\n这会导入来源，对其进行扫描/探测/生成缩略图，并回放状态。已有进度不会被覆盖。',
  'admin.backup.restore.queued': '恢复任务已排队：{jobId}',

  // Admin: jobs
  'admin.jobs.title': '最近任务',
  'admin.jobs.empty': '暂无任务。',
  'admin.table.progress': '进度',
  'admin.table.attempts': '尝试次数',
  'admin.table.error': '错误',

  // Admin: scan history
  'admin.scans.title': '扫描历史',
  'admin.scans.empty': '暂无扫描记录。',
  'admin.table.source': '来源',
  'admin.table.discovered': '发现',
  'admin.table.added': '新增',
  'admin.table.updated': '更新',
  'admin.table.missing': '缺失',
  'admin.table.failed': '失败',

  // Admin: paths
  'admin.paths.title': '路径',
  'admin.paths.data': '数据目录',
  'admin.paths.thumbnails': '缩略图目录',
  'admin.paths.transcodes': '转码目录',
  'admin.paths.version': '版本',
  'admin.paths.watch': '自动监听',
  'admin.watch.active': '{count} 个源监听中',
  'admin.watch.disabled': '未启用',
  'admin.watch.skipped': '未监听',

  // Admin: destructive source removal
  'admin.remove.confirm':
    '删除来源 {uri}？\n\n{detail}\n\n这会删除来源、媒体元数据、播放状态和已生成的产物。',
  'admin.remove.detail': '{media} 个媒体、{states} 条状态、{variants} 个产物',
  'admin.remove.done': '已删除来源：{media} 个媒体、{states} 条状态、{files} 个文件。',
  // Accounts: first run, sign-in and the session menu
  'auth.loading': '正在检查登录状态…',
  'auth.kicker': '天生私有',
  'auth.setup.title': '初始化 LocalReel',
  'auth.setup.subtitle': '创建所有者账户。它可以管理其他所有账户。',
  'auth.signIn.title': '登录',
  'auth.signIn.subtitle': '这个媒体库是私有的，请先登录。',
  'auth.field.username': '用户名',
  'auth.field.password': '密码',
  'auth.field.confirm': '确认密码',
  'auth.hint.password': '至少 8 个字符。',
  'auth.action.signIn': '登录',
  'auth.action.setup': '创建所有者账户',
  'auth.action.working': '处理中…',
  'auth.error.mismatch': '两次输入的密码不一致。',
  'auth.error.failed': '登录失败：{message}',
  'auth.error.setup': '创建账户失败：{message}',

  // Accounts: session and administration
  'admin.signedInAs': '当前账户：{username}',
  'admin.action.signOut': '退出登录',
  'admin.addSource.title': '添加媒体目录',
  'admin.addSource.hint': '指向运行 LocalReel 的机器上的目录，服务进程必须能读取它。',
  'admin.addSource.placeholder': 'D:\\Media 或 /volume1/media',
  'admin.addSource.kind': '类型',
  'admin.addSource.kindHint': '可选',
  'admin.addSource.submit': '添加并扫描',
  'admin.addSource.working': '添加中…',
  'admin.addSource.done': '已添加 {uri}，扫描已排队。',
  'admin.addSource.error': '添加目录失败：{message}',
  'admin.users.title': '账户',
  'admin.users.subtitle': '每位家庭成员都有独立的观看进度。',
  'admin.users.empty': '目前只有所有者账户。',
  'admin.users.username': '用户名',
  'admin.users.password': '密码',
  'admin.users.role': '角色',
  'admin.users.roleAdmin': '管理员',
  'admin.users.roleUser': '观看者',
  'admin.users.create': '创建账户',
  'admin.users.creating': '创建中…',
  'admin.users.enable': '启用',
  'admin.users.disable': '停用',
  'admin.users.delete': '删除',
  'admin.users.reset': '重置密码',
  'admin.users.resetPrompt': '为 {username} 设置新密码（至少 8 个字符）',
  'admin.users.deleteConfirm': '删除账户 {username}？其观看进度也会被删除。',
  'admin.users.self': '当前账户',
  'admin.users.lastLogin': '最近登录',
  'admin.users.never': '从未',
  'admin.users.created': '已创建账户 {username}。',
  'admin.users.failed': '账户操作失败：{message}',
  'admin.shutdown.title': '服务器',
  'admin.shutdown.help':
    '关闭正在运行的 LocalReel 进程。没有托盘图标的平台用这里退出；播放与进行中的任务会中断。',
  'admin.shutdown.action': '关闭服务器',
  'admin.shutdown.busy': '正在停止…',
  'admin.shutdown.confirm': '确定关闭 LocalReel 吗？播放与进行中的任务会立刻停止。',
  'admin.shutdown.done': '服务器已停止，可以关闭这个页面了。',
  'admin.ffmpeg.hint':
    '没有找到 ffmpeg：元数据、缩略图与转码不可用。请安装 ffmpeg、放到程序旁边的 ffmpeg/bin，或设置 LOCALREEL_FFMPEG。',
  'admin.backup.usersCreated':
    '恢复了 {count} 个账户，它们还没有密码，请在「账户」里设置。',
}

export const dictionaries: Record<Lang, Record<TranslationKey, string>> = { en, zh }

export type Translate = (key: TranslationKey, vars?: TranslationVars) => string

const PLACEHOLDER = /\{(\w+)\}/g

/** Translate `key` for `lang`, replacing `{name}` placeholders from `vars`. */
export function t(lang: Lang, key: TranslationKey, vars?: TranslationVars): string {
  const table = dictionaries[lang] ?? dictionaries.en
  const template = table[key] ?? String(key)
  if (!vars) return template
  return template.replace(PLACEHOLDER, (placeholder, name: string) => {
    const value = vars[name]
    return value === undefined ? placeholder : String(value)
  })
}

/** True when `value` is one of the supported language codes. */
export function isLang(value: unknown): value is Lang {
  return value === 'zh' || value === 'en'
}

/** Map a BCP 47 language tag to the closest UI language; unknown tags mean English. */
export function langFromNavigator(language: string | null | undefined): Lang {
  if (typeof language === 'string' && language.trim().toLowerCase().startsWith('zh')) {
    return 'zh'
  }
  return 'en'
}

/**
 * Resolve the UI language from a stored preference (only `zh`/`en` are valid)
 * and fall back to the browser language, then English.
 */
export function resolveLang(
  stored?: string | null,
  navigatorLanguage?: string | null,
): Lang {
  if (isLang(stored)) return stored
  return langFromNavigator(navigatorLanguage)
}

export interface LangEnvironment {
  stored?: string | null
  navigatorLanguage?: string | null
}

function readStoredLang(): string | null {
  try {
    if (typeof localStorage === 'undefined') return null
    return localStorage.getItem(LANG_STORAGE_KEY)
  } catch {
    return null
  }
}

function readNavigatorLanguage(): string | null {
  try {
    if (typeof navigator === 'undefined') return null
    return typeof navigator.language === 'string' ? navigator.language : null
  } catch {
    return null
  }
}

/**
 * Detect the initial language. The optional `env` argument keeps this pure and
 * testable; called with no arguments it reads localStorage and navigator.
 */
export function detectLang(env?: LangEnvironment): Lang {
  if (env) return resolveLang(env.stored, env.navigatorLanguage)
  return resolveLang(readStoredLang(), readNavigatorLanguage())
}

/** Persist the chosen language; storage may be unavailable/blocked, never fatal. */
export function persistLang(lang: Lang): void {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(LANG_STORAGE_KEY, lang)
  } catch {
    // Private mode or disabled storage: the in-memory choice still works.
  }
}

export interface LangController {
  lang: Lang
  setLang: (lang: Lang) => void
  t: Translate
}

/**
 * Language state for one page: initialised from storage/browser, persisted on
 * every change and re-rendering immediately. Each page owns one instance, so
 * pages stay independently mountable.
 */
export function useLang(): LangController {
  const [lang, setLangState] = useState<Lang>(detectLang)

  const setLang = useCallback((next: Lang) => {
    persistLang(next)
    setLangState(next)
  }, [])

  const translate = useCallback<Translate>((key, vars) => t(lang, key, vars), [lang])

  useEffect(() => {
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en'
  }, [lang])

  return { lang, setLang, t: translate }
}
