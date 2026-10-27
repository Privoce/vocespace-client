import { Fragment, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { legalDocuments, type LegalDocumentId } from './documents';
import { legalBlocks } from './markdown';
const documents = {
  privacy: legalBlocks(legalDocuments.privacy),
  terms: legalBlocks(legalDocuments.terms),
};
export interface LegalDocumentContentProps {
  documentId: LegalDocumentId;
  onOpenLink: (href: string) => void;
  onSectionLayout?: (id: string, y: number) => void;
}
function inline(text: string, onOpenLink: (href: string) => void): ReactNode[] {
  const pattern = /\[([^\]]+)\]\(([^)]+)\)|\*\*(.+?)\*\*|https:\/\/[^\s]+/g;
  const result: ReactNode[] = [];
  let start = 0;
  for (const match of text.matchAll(pattern)) {
    result.push(text.slice(start, match.index));
    const href = match[2] || (!match[3] ? match[0] : undefined);
    result.push(
      href ? (
        <Text
          key={match.index}
          accessibilityRole="link"
          style={s.link}
          onPress={() => onOpenLink(href)}
        >
          {match[1] || href}
        </Text>
      ) : (
        <Text key={match.index} style={s.bold}>
          {match[3]}
        </Text>
      ),
    );
    start = match.index! + match[0].length;
  }
  result.push(text.slice(start));
  return result;
}
export function LegalDocumentContent({
  documentId,
  onOpenLink,
  onSectionLayout,
}: LegalDocumentContentProps) {
  return (
    <View style={s.content}>
      {documents[documentId].map((block, index) => {
        if (block.kind === 'rule') return <View key={index} style={s.rule} />;
        if (block.kind === 'heading')
          return (
            <Text
              key={index}
              nativeID={block.id}
              accessibilityRole="header"
              selectable
              onLayout={(event) => onSectionLayout?.(block.id, event.nativeEvent.layout.y)}
              style={[
                s.heading,
                { fontSize: block.level === 1 ? 27 : block.level === 2 ? 21 : 18 },
              ]}
            >
              {inline(block.text, onOpenLink)}
            </Text>
          );
        if (block.kind === 'table')
          return (
            <ScrollView key={index} horizontal style={s.table}>
              <View>
                {block.rows.map((row, rowIndex) => (
                  <View key={rowIndex} style={s.tableRow}>
                    {row.map((cell, cellIndex) => (
                      <Text
                        selectable
                        key={cellIndex}
                        style={[
                          s.text,
                          s.cell,
                          cellIndex === 1 && { width: 340 },
                          rowIndex === 0 && s.bold,
                        ]}
                      >
                        {inline(cell, onOpenLink)}
                      </Text>
                    ))}
                  </View>
                ))}
              </View>
            </ScrollView>
          );
        if (block.kind === 'item')
          return (
            <View key={index} style={s.item}>
              <Text style={s.marker}>{block.marker}</Text>
              <Text selectable style={[s.text, { flex: 1 }]}>
                {inline(block.text, onOpenLink)}
              </Text>
            </View>
          );
        return (
          <Fragment key={index}>
            <Text selectable style={[s.text, block.kind === 'quote' && s.quote]}>
              {inline(block.text, onOpenLink)}
            </Text>
          </Fragment>
        );
      })}
    </View>
  );
}
const s = StyleSheet.create({
  content: { gap: 16, width: '100%' },
  heading: { color: '#fff', fontWeight: '700', marginTop: 12 },
  text: { color: '#ccc', fontSize: 15, lineHeight: 25 },
  bold: { fontWeight: '700', color: '#eee' },
  link: { color: '#22CCEE', textDecorationLine: 'underline' },
  rule: { height: 1, backgroundColor: '#3b3b3b', marginVertical: 8 },
  item: { flexDirection: 'row', gap: 10 },
  marker: { color: '#ccc', minWidth: 18, fontSize: 15, lineHeight: 25 },
  quote: { borderLeftWidth: 3, borderColor: '#555', paddingLeft: 14 },
  table: { borderWidth: 1, borderColor: '#444' },
  tableRow: { flexDirection: 'row' },
  cell: { width: 185, padding: 12, borderRightWidth: 1, borderBottomWidth: 1, borderColor: '#444' },
});
