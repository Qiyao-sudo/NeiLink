import { Locale, SupportedLanguage } from './types';
import { zhCN } from './zh-CN';
import { enUS } from './en-US';
import { LogEntry } from '../types';

// 语言包映射
const locales: Record<SupportedLanguage, Locale> = {
  'zh-CN': zhCN,
  'en-US': enUS,
};

// 获取语言包
export function getLocale(language: string): Locale {
  return locales[language as SupportedLanguage] || zhCN;
}

// 获取支持的语言列表
export function getSupportedLanguages(): Array<{ value: SupportedLanguage; label: string }> {
  return [
    { value: 'zh-CN', label: '简体中文' },
    { value: 'en-US', label: 'English' },
  ];
}

// 导出所有语言包
export { zhCN, enUS };
export type { Locale, SupportedLanguage };

function interpolateParams(template: string, params: string[]): string {
  return template.replace(/\{(\d+)\}/g, (_, idx) => {
    const i = parseInt(idx, 10);
    return i < params.length ? params[i] : `{${idx}}`;
  });
}

export function translateLogMessage(entry: LogEntry, locale: Locale): string {
  if (entry.messageKey) {
    const template = (locale.logMessages as Record<string, string | undefined>)[entry.messageKey];
    if (template) {
      return interpolateParams(template, entry.messageParams ?? []);
    }
  }
  return entry.message;
}
