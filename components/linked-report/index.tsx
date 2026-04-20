'use client';

import { useState } from 'react';
import { LinkedReportWorkspace } from './LinkedReportWorkspace';
import type { LinkedReportRouteProps } from './types';

export default function LinkedReportRoute(props: LinkedReportRouteProps) {
  const [reportKey, setReportKey] = useState(0);
  return (
    <LinkedReportWorkspace
      key={reportKey}
      {...props}
      onNewSession={() => setReportKey(k => k + 1)}
    />
  );
}
