/**
 * Format currency with ₹ symbol
 */
export function formatCurrency(amount: number): string {
  const absAmount = Math.abs(amount);
  if (absAmount >= 10000000) {
    return `${amount < 0 ? '-' : ''}₹${(absAmount / 10000000).toFixed(2)}Cr`;
  }
  if (absAmount >= 100000) {
    return `${amount < 0 ? '-' : ''}₹${(absAmount / 100000).toFixed(2)}L`;
  }
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format a date for display
 */
export function formatDate(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;

  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

/**
 * Format date for input fields
 */
export function formatDateInput(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Get month name
 */
export function getMonthName(monthIndex: number): string {
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  return months[monthIndex];
}

/**
 * Generate a random color from the palette
 */
export function getRandomColor(): string {
  const colors = [
    '#6c5ce7', '#00b894', '#0984e3', '#e17055',
    '#fd79a8', '#fdcb6e', '#00cec9', '#a29bfe',
    '#74b9ff', '#fab1a0',
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

/**
 * Calculate percentage change
 */
export function percentChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / Math.abs(previous)) * 100;
}

/**
 * Truncate text with ellipsis
 */
export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + '...';
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}
