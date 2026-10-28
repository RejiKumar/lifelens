import { StyleSheet } from 'react-native';

import { ExpandableText } from '@/components/ui/expandable-text';
import { GlassCard } from '@/components/ui/glass-card';
import { Typography } from '@/components/ui/typography';
import { Size } from '@/constants/theme';

export interface EvidenceCardProps {
  evidence: string[];
  heading?: string;
}

export function EvidenceCard({ evidence, heading = 'Evidence' }: EvidenceCardProps) {
  if (!Array.isArray(evidence) || evidence.length === 0) return null;

  return (
    <GlassCard>
      <Typography variant="title" accessibilityRole="header" style={styles.heading}>
        {heading}
      </Typography>
      {evidence.map((item, index) => (
        <ExpandableText
          key={`evidence-${index}`}
          text={`• ${item}`}
          numberOfLines={3}
          variant="body"
          themeColor="textSecondary"
          style={styles.item}
        />
      ))}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  heading: {
    marginBottom: Size.sm,
  },
  item: {
    marginBottom: Size.xs,
  },
});