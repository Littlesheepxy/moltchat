# 主页多语言支持完成

## ✅ 完成的工作

### 1. **创建多语言内容配置文件**
- 文件：`apps/console/lib/landing-content.ts`
- 支持 7 种语言：`zh`, `en`, `ja`, `ko`, `es`, `pt`, `ar`
- 包含所有页面内容：
  - Phase 1 (试验场/Playground)
  - Phase 2 (成长/Growth)
  - Phase 3 (回到人类/Return to Humans)
  - CTA 区域
  - Footer

### 2. **更新主页使用多语言配置**
- 文件：`apps/console/app/page.tsx`
- 移除所有硬编码的 `isChinese ? '中文' : 'English'` 判断
- 使用统一的 `content` 对象获取当前语言的内容
- 自动 fallback 到英文（如果某个语言缺失）

### 3. **Hero 区域打字机效果**
- 保留独立的 `heroTexts` 对象（因为需要动态打字）
- 支持所有 7 种语言
- 语言切换时自动重新播放打字机动画

### 4. **🆕 自动检测浏览器语言**
- 文件：`apps/console/lib/i18n-provider.tsx`
- 首次访问时自动检测浏览器语言
- 优先级：localStorage > 浏览器语言 > 默认语言（en）
- 支持语言代码映射（如 `zh-CN` → `zh`, `en-US` → `en`）

## 🌍 支持的语言

| 语言 | 代码 | 状态 |
|------|------|------|
| 🇨🇳 中文 | `zh` | ✅ 完整翻译 |
| 🇺🇸 English | `en` | ✅ 完整翻译 |
| 🇯🇵 日本語 | `ja` | ✅ 完整翻译 |
| 🇰🇷 한국어 | `ko` | ✅ 完整翻译 |
| 🇪🇸 Español | `es` | ✅ 完整翻译 |
| 🇧🇷 Português | `pt` | ✅ 完整翻译 |
| 🇸🇦 العربية | `ar` | ✅ 完整翻译 |

## 📝 内容结构

### landingContent 对象结构

```typescript
{
  signIn: string;
  phase1: {
    tag: string;
    title: string;
    content: string[];
    highlight: string;
  };
  phase2: {
    tag: string;
    title: string;
    intro: string;
    bullets: string[];
    content: string[];
    highlight: string;
  };
  phase3: {
    tag: string;
    title: string;
    intro: string[];
    bullets: string[];
    content: string[];
    highlight: string[];
  };
  cta: {
    title: string[];
    button: string;
    howTo: string;
    prompt: string;
    steps: string[];
  };
  footer: {
    copyright: string;
    tagline: string;
  };
}
```

## 🎯 语言检测逻辑

### 优先级
1. **localStorage** - 用户之前手动选择的语言（最高优先级）
2. **浏览器语言** - 自动检测 `navigator.language`
3. **默认语言** - 英文（en）

### 检测流程
```typescript
// 1. 检查 localStorage
const saved = localStorage.getItem('locale');
if (saved && isSupported(saved)) {
  return saved; // 使用已保存的语言
}

// 2. 检测浏览器语言
const browserLang = navigator.language; // 如 "zh-CN", "en-US", "ja"
const primaryLang = browserLang.split('-')[0]; // 提取主语言代码

if (isSupported(primaryLang)) {
  return primaryLang; // 使用浏览器语言
}

// 3. 使用默认语言
return 'en';
```

### 语言代码映射

| 浏览器语言 | 映射结果 | 说明 |
|------------|----------|------|
| `zh-CN` | `zh` | 简体中文 |
| `zh-TW` | `zh` | 繁体中文（暂用简体） |
| `en-US` | `en` | 美式英语 |
| `en-GB` | `en` | 英式英语 |
| `ja-JP` | `ja` | 日语 |
| `ko-KR` | `ko` | 韩语 |
| `es-ES` | `es` | 西班牙语 |
| `pt-BR` | `pt` | 葡萄牙语 |
| `ar-SA` | `ar` | 阿拉伯语 |

## 📱 用户体验流程

### 在页面中使用
```typescript
// 获取当前语言的内容
const { locale } = useI18n();
const content = landingContent[locale as SupportedLocale] || landingContent.en;

// 使用内容
<h2>{content.phase1.title}</h2>
<p>{content.phase1.content[0]}</p>
```

### 添加新语言
1. 在 `apps/console/i18n/config.ts` 添加新语言代码
2. 在 `apps/console/lib/landing-content.ts` 添加新语言的所有内容
3. 在 `apps/console/app/page.tsx` 的 `heroTexts` 对象中添加 Hero 文案

## ✨ 特性

### 1. **Fallback 机制**
```typescript
const content = landingContent[locale as SupportedLocale] || landingContent.en;
```
如果某个语言没有定义，自动使用英文。

### 2. **类型安全**
```typescript
export type SupportedLocale = keyof typeof landingContent;
```
TypeScript 自动推导支持的语言类型。

### 3. **语言切换自动重置**
```typescript
useEffect(() => {
  setShowSecondLine(false);
  secondLineTriggered.current = false;
  setHeroKey(prev => prev + 1); // 强制重新渲染
}, [locale]);
```
切换语言时，Hero 打字机效果会重新播放。

### 4. **数组内容智能渲染**
```typescript
// 空字符串会渲染为间距
{content.phase1.content.map((line, i) => (
  line ? <p key={i}>{line}</p> : <p key={i} className="pt-4" />
))}
```

## 🎯 页面覆盖

### ✅ 已完成多语言支持的部分
- Header（登录按钮）
- Hero 打字机效果
- Phase 1（试验场）
- Phase 2（成长）
- Phase 3（回到人类）
- CTA 区域（按钮、折叠说明）
- Footer（版权、标语）

### 📦 保持英文的部分
- 代码示例：`Read ${APP_URL}/skill.md...`（技术文档链接）
- Logo 和 brand 名称：`MoltChat`

## 🚀 测试方法

1. 启动开发服务器：
```bash
cd apps/console
pnpm dev
```

2. 访问 `http://localhost:3000`

3. 点击右上角的语言切换按钮，测试所有 7 种语言

4. 验证：
   - Hero 打字机效果是否重新播放
   - 所有文案是否正确显示
   - 滚动叙事是否正常
   - CTA 按钮和折叠说明是否翻译

## 📚 未来扩展

### 添加新内容时
1. 在 `landing-content.ts` 中为所有语言添加新字段
2. 在 `page.tsx` 中使用 `content.newField` 渲染

### 添加新语言时
1. 更新 `i18n/config.ts`
2. 更新 `landing-content.ts`
3. 更新 `page.tsx` 中的 `heroTexts`
4. 如果需要，添加对应的 `messages/{locale}.json`

## ⚠️ 注意事项

### RTL 语言支持
阿拉伯语（ar）是从右到左（RTL）的语言。如果需要完美支持，可能需要添加：

```tsx
<div dir={locale === 'ar' ? 'rtl' : 'ltr'}>
  {/* content */}
</div>
```

### 文案长度
不同语言的文案长度差异很大：
- 英文通常较短
- 德语通常较长
- 中文最紧凑
- 阿拉伯语可能需要更多垂直空间

当前使用响应式字体大小（`text-xl md:text-2xl`）可以适应大部分情况。

---

**更新时间**: 2026-02-04  
**负责人**: Claude  
**状态**: ✅ 完成
