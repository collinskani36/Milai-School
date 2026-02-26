import React from 'react';
import { Badge } from '@/Components/ui/badge';

interface PerformanceBadgeProps {
  level: 'EE' | 'ME' | 'AE' | 'BE' | null | undefined;
  className?: string;
}

const levelColors = {
  EE: 'bg-green-100 text-green-800 border-green-200',
  ME: 'bg-blue-100 text-blue-800 border-blue-200',
  AE: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  BE: 'bg-red-100 text-red-800 border-red-200',
};

export const PerformanceBadge: React.FC<PerformanceBadgeProps> = ({ level, className }) => {
  if (!level) return null;
  return (
    <Badge variant="outline" className={`${levelColors[level]} ${className || ''}`}>
      {level}
    </Badge>
  );
};