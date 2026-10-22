import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { PhoneMeetingProps } from './types';

type Labels = Pick<PhoneMeetingProps, 'labels' | 'Icon'>;
export function MeetingLayoutSwitch({
  labels,
  Icon,
  focused,
  disabled,
  onChange,
}: Labels & { focused: boolean; disabled: boolean; onChange: (focus: boolean) => void }) {
  return (
    <View style={s.switch} accessibilityRole="tablist">
      {[false, true].map((focus) => {
        const selected = focus === focused;
        const label = focus ? labels.focusLayout || labels.focus : labels.grid || 'Grid';
        return (
          <Pressable
            key={String(focus)}
            accessibilityRole="tab"
            accessibilityLabel={label}
            accessibilityState={{ selected, disabled }}
            aria-selected={selected}
            disabled={disabled}
            onPress={() => onChange(focus)}
            style={[s.option, selected && s.selected]}
          >
            {Icon && (
              <Icon
                name={focus ? 'focus' : 'app'}
                size={14}
                color={selected ? '#22CCEE' : '#829EAE'}
              />
            )}
            {/* <Text style={[s.label, selected && s.active]}>{label}</Text> */}
          </Pressable>
        );
      })}
    </View>
  );
}

export function MeetingPagination({
  labels,
  Icon,
  page,
  pages,
  onChange,
}: Labels & { page: number; pages: number; onChange: (page: number) => void }) {
  // Keep the control bounded in large meetings while exposing every page via the arrows/swipe.
  const start = Math.max(0, Math.min(page - 3, pages - 7));
  return (
    <View style={s.pager}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={labels.previous}
        disabled={page === 0}
        accessibilityState={{ disabled: page === 0 }}
        onPress={() => onChange(page - 1)}
        style={[s.arrow, page === 0 && s.disabled]}
      >
        {Icon ? (
          <Icon name="back" size={14} color="#829EAE" />
        ) : (
          <Text style={s.label}>{labels.previous}</Text>
        )}
      </Pressable>
      <View style={s.dots}>
        {Array.from({ length: Math.min(pages, 7) }, (_, index) => start + index).map((index) => (
          <Pressable
            key={index}
            accessibilityRole="button"
            accessibilityLabel={`${labels.page || 'Page'} ${index + 1}`}
            accessibilityState={{ selected: index === page }}
            onPress={() => onChange(index)}
            style={s.dotTarget}
          >
            <View style={[s.dot, index === page && s.currentDot]} />
          </Pressable>
        ))}
      </View>
      <Text style={s.label} accessibilityLiveRegion="polite">
        {page + 1} / {pages}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={labels.next}
        disabled={page === pages - 1}
        accessibilityState={{ disabled: page === pages - 1 }}
        onPress={() => onChange(page + 1)}
        style={[s.arrow, page === pages - 1 && s.disabled]}
      >
        {Icon ? (
          <View style={{ transform: [{ rotate: '180deg' }] }}>
            <Icon name="back" size={14} color="#829EAE" />
          </View>
        ) : (
          <Text style={s.label}>{labels.next}</Text>
        )}
      </Pressable>
    </View>
  );
}
const s = StyleSheet.create({
  switch: {
    flexDirection: 'row',
    backgroundColor: '#14212A',
    borderColor: '#30434F',
    borderWidth: 1,
    borderRadius: 8,
    padding: 2,
    flexShrink: 0,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    minHeight: 34,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  selected: { backgroundColor: '#23424E' },
  label: { color: '#829EAE', fontSize: 11 },
  active: { color: '#22CCEE' },
  pager: {
    minHeight: 26,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  dots: { flexDirection: 'row' },
  dotTarget: { width: 22, minHeight: 26, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#34434C' },
  currentDot: { width: 16, backgroundColor: '#22CCEE' },
  arrow: { minWidth: 26, minHeight: 26, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.3 },
});
