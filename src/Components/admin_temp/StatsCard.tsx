import React from 'react';
import { motion } from 'framer-motion';
import { Card } from '@/Components/ui/card';

type StatsCardProps = {
  title: React.ReactNode;
  value: React.ReactNode;
  icon?: React.ComponentType<any>;
  color?: string;
  trend?: React.ReactNode;
  onClick?: () => void;
};

export default function StatsCard({ title, value, icon: Icon, color = 'bg-gray-200', trend, onClick }: StatsCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Card 
        className={`relative overflow-hidden border-none shadow-sm hover:shadow-md transition-all duration-300 ${onClick ? 'cursor-pointer' : ''}`}
        onClick={onClick}
      >
        <div className="p-6">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-500 tracking-wide uppercase">{title}</p>
              <p className="text-3xl font-bold text-gray-900">{value}</p>
              {trend && (
                <p className="text-xs text-gray-500">{trend}</p>
              )}
            </div>
            <div className={`p-3 rounded-2xl ${color} bg-opacity-10`}>
              <Icon className={`w-6 h-6 ${color.replace('bg-', 'text-')}`} />
            </div>
          </div>
        </div>
        <div className={`absolute bottom-0 left-0 right-0 h-1 ${color}`} />
      </Card>
    </motion.div>
  );
}