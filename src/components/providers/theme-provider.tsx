'use client';

import * as React from 'react';
import { ThemeProvider as NextThemes } from 'next-themes';

type ThemeProviderProps = React.ComponentProps<typeof NextThemes>;

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemes {...props}>{children}</NextThemes>;
}
