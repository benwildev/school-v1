declare module 'lucide-react';
declare module 'next/font/google';

declare module '@base-ui/react/button' {
  import * as React from 'react';
  export namespace Button {
    export type Props = React.ButtonHTMLAttributes<HTMLButtonElement>;
  }
  export const Button: React.ForwardRefExoticComponent<React.ButtonHTMLAttributes<HTMLButtonElement>>;
}
