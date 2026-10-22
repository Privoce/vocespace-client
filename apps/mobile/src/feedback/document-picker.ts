import { requireOptionalNativeModule } from 'expo';

/** Older development builds can still open meetings and send text feedback. */
export async function pickFeedbackDocument() {
  if (!requireOptionalNativeModule('ExpoDocumentPicker'))
    throw new Error('DOCUMENT_PICKER_UNAVAILABLE');
  const { getDocumentAsync } = await import('expo-document-picker');
  return getDocumentAsync({
    type: '*/*',
    copyToCacheDirectory: true,
    multiple: false,
  });
}
