
export interface AddDeviceInfo {
  microphone: {
    enabled: boolean;
    self: number;
    other: number;
  };
  video: {
    enabled: boolean;
    blur: number;
  };
  screen: {
    enabled: boolean;
    blur: number;
  };
}


export const default_device = (): AddDeviceInfo => {
  return {
    microphone: {
      enabled: false,
      self: 100,
      other: 20,
    },
    video: {
      enabled: false,
      blur: 0.15,
    },
    screen: {
      enabled: false,
      blur: 0.15,
    },
  };
};
