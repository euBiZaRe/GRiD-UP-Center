import React, { useEffect } from 'react';
import { motion, useSpring, useTransform, useMotionValue } from 'framer-motion';

interface RollingNumberProps {
  value: number;
  className?: string;
  precision?: number;
}

export const RollingNumber: React.FC<RollingNumberProps> = ({ value, className, precision = 0 }) => {
  const motionValue = useMotionValue(value);
  const springValue = useSpring(motionValue, {
    stiffness: 400,
    damping: 40,
    mass: 1
  });

  useEffect(() => {
    motionValue.set(value);
  }, [value, motionValue]);

  const displayValue = useTransform(springValue, (latest) => {
    return latest.toFixed(precision);
  });

  return (
    <motion.span className={className}>
      {displayValue}
    </motion.span>
  );
};
