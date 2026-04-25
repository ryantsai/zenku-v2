import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type React from 'react';
import { toast } from 'sonner';
import { getViews, ApiError } from '../api';
import type { ViewDefinition } from '../types';

interface ViewsContextValue {
  views: ViewDefinition[];
  fetchViews: () => Promise<void>;
}

const ViewsContext = createContext<ViewsContextValue>({
  views: [],
  fetchViews: async () => {},
});

export function ViewsProvider({ children }: { children: React.ReactNode }) {
  const [views, setViews] = useState<ViewDefinition[]>([]);

  const { t } = useTranslation();

  const fetchViews = useCallback(async () => {
    try {
      const data = await getViews();
      setViews(data.map(d => d.definition));
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(String(t(`errors.${err.code}`, { ...err.params, defaultValue: err.code })));
      } else {
        toast.error(t('common.error'));
      }
    }
  }, [t]);

  useEffect(() => {
    void fetchViews();
  }, [fetchViews]);

  return (
    <ViewsContext.Provider value={{ views, fetchViews }}>
      {children}
    </ViewsContext.Provider>
  );
}

export function useViews() {
  return useContext(ViewsContext);
}
