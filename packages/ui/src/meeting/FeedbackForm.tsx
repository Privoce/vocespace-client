import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { FebType, type FeedbackFormProps } from './feedback-types';
/** One form and draft lifecycle; file selection, identity and delivery belong to each adapter. */
export function FeedbackForm({
  t,
  varient = FebType.Feedback,
  target,
  accountEmail,
  Button,
  Input,
  onUpload,
  onSubmit,
  onDone,
  onBusyChange,
}: FeedbackFormProps) {
  const [email, setEmail] = useState('');
  const [kind, setKind] = useState(varient === FebType.Report ? 'abuse' : 'bug');
  const [other, setOther] = useState('');
  const [content, setContent] = useState('');
  const [attachments, setAttachments] = useState<{ name: string; url: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const active = useRef(true);
  const pending = useRef(false);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const report = varient === FebType.Report;
  const text = (key: string) => {
    const reportField = report &&
      (['type', 'content', 'content_placeholder', 'submit'].includes(key) || key.startsWith('types.'));
    return t(`${reportField ? 'moderation.report' : 'channel.feedback'}.${key}`);
  };
  const effectiveEmail = (accountEmail || email).trim().toLowerCase();
  function validateEmail() {
    if (!effectiveEmail) return 'validation.email_required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(effectiveEmail)) return 'validation.email_invalid';
  }
  async function run(upload: boolean) {
    if (pending.current) return;
    const invalid =
      validateEmail() ||
      (!upload &&
        (!content.trim()
          ? 'validation.content_required'
          : kind === 'other' && !other.trim()
            ? 'validation.type_required'
            : ''));
    if (invalid) {
      setError(text(invalid));
      return;
    }
    pending.current = true;
    setBusy(true);
    setError('');
    onBusyChange?.(true);
    try {
      if (upload) {
        const file = await onUpload(effectiveEmail);
        if (file && (!file.url || typeof file.url !== 'string' || typeof file.name !== 'string'))
          throw new Error('UPLOAD_FAILED');
        if (active.current && file) setAttachments((previous) => [...previous, file]);
      } else {
        await onSubmit({
          varient,
          ...(report ? { target } : {}),
          email: effectiveEmail,
          feedbackType: kind === 'other' ? other.trim() : kind,
          content: content.trim(),
          attachments: attachments.map((item) => item.url),
        });
        if (active.current) onDone();
      }
    } catch (error) {
      if (active.current)
        setError(
          text(
            error instanceof Error && error.message === 'FILE_TOO_LARGE'
              ? 'validation.file_too_large'
              : error instanceof Error && error.message === 'DOCUMENT_PICKER_UNAVAILABLE'
                ? 'document_picker_unavailable'
                : upload
                  ? 'upload_error'
                  : 'submit_error',
          ),
        );
    } finally {
      pending.current = false;
      if (active.current) {
        setBusy(false);
        onBusyChange?.(false);
      }
    }
  }
  return (
    <View style={styles.form}>
      {report && target && <Text style={styles.label}>{target.name} · {target.spaceName}</Text>}
      <Text style={styles.label}>{text('email')}</Text>
      <Input
        value={accountEmail || email}
        disabled={busy || !!accountEmail}
        onChangeText={setEmail}
        placeholder={text('email_placeholder')}
        onSubmit={() => {}}
        maxLength={254}
      />
      <Text style={styles.label}>{text('type')}</Text>
      <View style={styles.types}>
        {(report ? ['abuse', 'spam', 'illegal', 'other'] : ['bug', 'error', 'question', 'suggestion', 'other']).map((value) => (
          <Button
            key={value}
            label={text(`types.${value}`)}
            appearance="option"
            active={kind === value}
            disabled={busy}
            onPress={() => setKind(value)}
          >
            {text(`types.${value}`)}
          </Button>
        ))}
      </View>
      {kind === 'other' && (
        <Input
          value={other}
          disabled={busy}
          onChangeText={setOther}
          placeholder={text('other_placeholder')}
          onSubmit={() => {}}
          maxLength={100}
        />
      )}
      <Text style={styles.label}>{text('content')}</Text>
      <Input
        multiline
        value={content}
        disabled={busy}
        onChangeText={setContent}
        placeholder={text('content_placeholder')}
        onSubmit={() => {}}
        maxLength={10000}
      />
      <Text style={styles.label}>{text('attachments')}</Text>
      <Button
        disabled={busy}
        onPress={() => {
          void run(true);
        }}
      >
        {text('upload_action')}
      </Button>
      <Text style={styles.hint}>{text('upload_hint')}</Text>
      {attachments.map((item, index) => (
        <Text key={`${item.url}-${index}`} style={styles.label}>
          {item.name} · {text('upload_done')}
        </Text>
      ))}
      {!!error && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
      <Button
        appearance="primary"
        disabled={busy}
        onPress={() => {
          void run(false);
        }}
      >
        {busy ? text('uploading_wait') : text('submit')}
      </Button>
    </View>
  );
}
const styles = StyleSheet.create({
  form: { gap: 12, padding: 16 },
  label: { color: '#C8D6DF', fontSize: 14 },
  hint: { color: '#829EAE', fontSize: 12, lineHeight: 18 },
  types: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  error: { color: '#FF6B82', fontSize: 13 },
});
