import ShinyText from './ShinyText';

// Convenience wrapper for the app's loading states: keeps the existing muted-gray
// look (base color #888 with a white shine) so it slots in wherever the old
// `Loading…` text lived.
export default function LoadingText({ text = 'Loading…', className = '', speed = 2.5, shineColor = '#ffffff', color = '#888', ...rest }) {
  return (
    <ShinyText
      text={text}
      color={color}
      shineColor={shineColor}
      speed={speed}
      spread={120}
      className={className}
      {...rest}
    />
  );
}
