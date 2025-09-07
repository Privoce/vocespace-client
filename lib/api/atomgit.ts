export interface AtomgitUser {
  userId: number;
  name: string;
  login: string;
  avatar: string | null;
  countryCode: string;
  phone: string;
  email: string;
  status: number;
  invitorId: number | null;
  gender: number;
  createAt: number;
  updateAt: number;
  token: string | null;
  userConfigList: any[] | null;
  userConfig: Record<string, any>;
  hasAddress: boolean;
  hasPhoto: boolean;
  invitationFrom: string | null;
  password: string | null;
  hasPassword: boolean;
  address: string | null;
}

export interface AtomgitTeamUser {
  teamUserId: number | null;
  teamId: number;
  courseId: number;
  userId: number | null;
  user: AtomgitUser;
  createAt: number;
  updateAt: number;
  courseRank: number | null;
}

export interface AtomgitTeamInfo {
  teamId: number;
  campId: number;
  courseId: number;
  name: string;
  city: string;
  status: number;
  school: string | null;
  count: number;
  wxContact: string | null;
  wxGroup: string | null;
  leaderId: number;
  allPromotion: boolean;
  config: any | null;
  leaderUser: AtomgitUser;
  leaderUserAddress: string | null;
  createAt: number;
  updateAt: number;
  teamUserList: AtomgitTeamUser[];
}

export const atomgitGetTeamInfo = async (teamId: number): Promise<AtomgitTeamInfo | null> => {
    console.warn('Fetching team info for teamId:', teamId);
  try {
    const response = await fetch('https://opencamp.cn/api/team/get', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        teamId
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const {data}: {data: AtomgitTeamInfo,result?: number, msg: string} = await response.json();
    console.warn('Fetched team info:', data);
    return data;
  } catch (error) {
    console.error('Failed to fetch team info:', error);
    return null;
  }
}