// apps/webapp/src/components/common/DebugAuth.tsx
import React, { useState } from 'react';
import { api } from '../../lib/api/index';
import { getInitDataRaw } from '../../lib/telegram';

export default function DebugAuth() {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const testAuth = async () => {
    setLoading(true);
    try {
      const data = await api('/_debug');
      setResult(data);
    } catch (error: any) {
      setResult({ error: error.message });
    } finally {
      setLoading(false);
    }
  };

  const testVerify = async () => {
    setLoading(true);
    try {
      const data = await api('/_verify');
      setResult(data);
    } catch (error: any) {
      setResult({ error: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '10px', border: '1px solid #ccc', margin: '10px 0' }}>
      <h3>Auth Debug</h3>
      <div style={{ marginBottom: '10px' }}>
        <button onClick={testAuth} disabled={loading}>Test /_debug</button>
        <button onClick={testVerify} disabled={loading} style={{ marginLeft: '10px' }}>
          Test /_verify
        </button>
      </div>
      <div>
        <strong>Init Data:</strong>
        <pre style={{ fontSize: '10px', overflow: 'auto' }}>
          {getInitDataRaw() || 'No init data found'}
        </pre>
      </div>
      {result && (
        <div>
          <strong>Result:</strong>
          <pre style={{ fontSize: '10px', overflow: 'auto' }}>
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}