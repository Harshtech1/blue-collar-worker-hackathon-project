import { useQuery } from '@tanstack/react-query';
import { db } from '@/lib/db';
import { useLanguage } from '@/contexts/LanguageContext';
import { MOCK_SERVICES } from '@/data/mockServices';

export interface ServiceCategory {
  id: string;
  name: string;
  name_hi?: string;
  name_bn?: string;
  name_gu?: string;
  description?: string;
  icon: string;
  color: string;
  is_active: boolean;
  display_order: number;
  localizedName?: string;
  category?: string;
}

export function useServices() {
  const { language } = useLanguage();
  const localizedMocks = MOCK_SERVICES.map((service) => ({
    ...service,
    localizedName:
      language === 'hi' ? service.name_hi || service.localizedName || service.name :
        language === 'bn' ? service.name_bn || service.localizedName || service.name :
          language === 'gu' ? service.name_gu || service.localizedName || service.name :
            service.localizedName || service.name,
  }));

  return useQuery<ServiceCategory[]>({
    queryKey: ['services', language],
    queryFn: async () => {
      let dbData: any[] = [];

      try {
        const { data, error } = await db
          .collection('service_categories')
          .select('*')
          .eq('is_active', true)
          .order('display_order');

        if (!error && data) {
          dbData = data;
        }
      } catch (e) {
        console.warn('DB fetch failed, using mocks only.');
      }

      const mappedDbData = dbData.map((service) => ({
        ...service,
        localizedName:
          language === 'hi' ? service.name_hi || service.name :
            language === 'bn' ? service.name_bn || service.name :
              language === 'gu' ? service.name_gu || service.name :
                service.name,
      }));

      // If DB has data, return it. Otherwise, return MOCK_SERVICES
      if (mappedDbData.length > 0) {
        return mappedDbData;
      }

      return localizedMocks;
    },
    initialData: localizedMocks,
    placeholderData: (previousData) => previousData ?? localizedMocks,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 2,
    refetchOnWindowFocus: false,
  });
}

export function useServiceById(id: string) {
  return useQuery({
    queryKey: ['service', id],
    queryFn: async () => {


      const { data, error } = await db
        .collection('service_categories')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      return data as ServiceCategory | null;
    },
    enabled: !!id,
  });
}
