// The Customer app's design system (see tokens.ts). Screens import from here, not the shared @fonzkart/ui look,
// which the Partner and Admin apps keep.
export { customerPalettes, DesignContext, MAX_CONTENT, motion, radii, type, useDesign, type Design } from './tokens';
export { Icon, type IconName } from './Icon';
export { Tap } from './Tap';
export { Glass } from './Glass';
export { Skeleton, SkeletonCard, SkeletonRows, SkeletonScreen, SkeletonTiles } from './Skeleton';
export { Button, LoadingDots } from './Button';
export { SearchBar, TextField } from './Fields';
export { EmptyState, ErrorState, Notice } from './Feedback';
export { Card, IconBadge, InfoRow, ListItem, SectionHeader } from './Surfaces';
export { ChoiceCard, Chip, QuestionStepView, Segmented, YesNo } from './Choices';
export { OrderCard, StatusBadge, Tracker } from './Orders';
export { ProductImage, Tile } from './Media';
export { DeviceSkeleton, deviceKindOf, type DeviceKind } from './DeviceSkeleton';
export { ActionBar, Appear, Page, PAGE_PADDING, TAB_BAR_HEIGHT, useTabBarSpace } from './Page';
export { AppHeader, IconButton, TabTitle } from './Header';
export { festiveGreeting, festiveLook } from './festive';
