export type RootStackParamList = {
  MainTabs: undefined;
  CreatePet: undefined;
  PetDetail: {petId: string};
  EditPet: {petId: string};
  PetQR: {petId: string};
  QRScanner: undefined;
  PublicPet: {qrToken: string};
  PetHealth: {petId: string};
  EmergencyInfo: {petId: string};
  PetGuardians: {petId: string};
  OwnershipVerification: {petId: string};
  ReportLost: {petId?: string};
  ReportFound: undefined;
  Sighting: {lostPostId: string};
  LostPostDetail: {postId: string};
  FoundPostDetail: {postId: string};
  Notifications: undefined;
  LostAlerts: undefined;
  SponsoredAds: undefined;
  EditProfile: undefined;
  MyPosts: undefined;
  Privacy: undefined;
  ChatList: undefined;
  ChatThread: {conversationId: string};
  Admin: undefined;
};

export type AuthStackParamList = {Login: undefined; Register: undefined};
export type MainTabParamList = {
  Home: undefined;
  Nearby: undefined;
  Report: undefined;
  MyPets: undefined;
  Profile: undefined;
};
