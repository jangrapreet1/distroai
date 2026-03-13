import * as React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> { }

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, ...props }, ref) => {
        return (
            <button
                ref={ref}
                className={`inline-flex items-center justify-center rounded-md text-sm font-medium ${className || ''}`}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
