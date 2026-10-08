export interface ClubPost {
  id: string;
  caption: string;
  likeCount: number | null;
  commentCount: number | null;
  takenAt: number | null;
  images: string[];
}

export interface ClubMember {
  name: string;
  avatar: string;
}

export interface ClubSchedule {
  day: string;
  time: string;
  location: string;
  distance: string;
  pace: string;
}

export interface ClubStats {
  instagramFollowers: number;
  stravaMembers: number;
  postsCount: number;
}

export interface ClubData {
  name: string;
  location: string;
  stravaUrl: string;
  instagramUrl: string;
  tagline: string;
  punchlines: string[];
  description: string;
  schedule: ClubSchedule;
  stats: ClubStats;
  assets: {
    stravaCover: string;
    stravaAvatar: string;
    instagramAvatar: string;
  };
  membersPreview: ClubMember[];
  posts: ClubPost[];
}
