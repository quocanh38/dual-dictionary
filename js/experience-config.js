export const EXPERIENCE_VERSION = 'v203-dictionary-repeat';
export const CONSENT_NOTICE = 'experience-v5';
export const TOEIC_PART5_SAMPLE = 'toeic-sample-part5';
export const TOEIC_PART5_SOURCE = 'seo_toeic_part5';
export const OPERATIONAL_EVENTS = Object.freeze(['audio_start', 'audio_ready', 'audio_error']);

export const JOURNEY_STEPS = Object.freeze({
  lookup: ['opened','download_needed','download_failed','result','miss','error'],
  reader: ['opened','reading','lookup_started','result','continued','download_needed','download_failed','miss','error'],
  review: ['opened','empty','card','result','returned'],
  chat: ['opened','setup','sent','response','completed','error','stopped','retry','retry_success','followup','saved'],
  toeic_ai: ['opened','setup','sent','response','completed','error','stopped','retry','retry_success','followup','saved'],
  tutor: ['opened','setup','sent','response','error','stopped','followup','saved'],
  lesson_studio: ['opened','setup','sent','response','error','stopped','retry','retry_success','saved'],
});
export const JOURNEY_SOURCES = Object.freeze(['app','welcome','lookup_link','reader_landing','reader','dictionary','toeic','review','vault','history','practice','lesson','writing','speaking','tutor']);
export const JOURNEY_REASONS = Object.freeze(['quota','timeout','network','setup','other']);
export const UX_SIGNALS = Object.freeze({
  dictionary_download_error: 'Tải từ điển · hiển thị lỗi',
  dictionary_download_repeat_pending: 'Tải từ điển · bấm lặp khi đang chờ',
  dictionary_help_open: 'Tải từ điển · mở trợ giúp',
  app_help_open: 'Ứng dụng · mở trợ giúp',
  chat_response_error: 'Chat Gemini · hiển thị lỗi phản hồi',
  toeic_response_error: 'Giải thích TOEIC · hiển thị lỗi phản hồi',
});
export const FEEDBACK_TOPICS = Object.freeze(['other','toeic','reader','gemini','offline','lookup','chat','review']);
