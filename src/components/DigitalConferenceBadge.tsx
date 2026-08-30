import React from 'react';
import { ConferencePass, ConferencePassProps, PassBadgeData, PassBadgeGroupColor } from './ConferencePass';

export type { PassBadgeData, PassBadgeGroupColor };

export const DigitalConferenceBadge: React.FC<ConferencePassProps> = (props) => {
  return <ConferencePass {...props} />;
};

export default DigitalConferenceBadge;
