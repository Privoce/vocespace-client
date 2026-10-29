import Constants from 'expo-constants';
interface MobileConfiguration {
  mobile: { apiUrl: string; meetingUiPreview: boolean };
  analytics: { enabled: boolean; url: string; websiteId: string };
}
const value = Constants.expoConfig?.extra?.vocespace as Partial<MobileConfiguration> | undefined;
// Public build projection only; never import the private JSON into Metro.
export const mobileConfig: MobileConfiguration = {
  mobile: { apiUrl: value?.mobile?.apiUrl || '', meetingUiPreview: value?.mobile?.meetingUiPreview === true },
  analytics: {
    enabled: value?.analytics?.enabled === true,
    url: value?.analytics?.url || '',
    websiteId: value?.analytics?.websiteId || '',
  },
};
