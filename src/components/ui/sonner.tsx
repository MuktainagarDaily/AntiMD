import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "light" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="top-center"
      closeButton
      richColors={false}
      duration={4000}
      visibleToasts={4}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-card group-[.toaster]:text-card-foreground group-[.toaster]:border group-[.toaster]:border-border/60 group-[.toaster]:shadow-xl group-[.toaster]:rounded-xl group-[.toaster]:backdrop-blur supports-[backdrop-filter]:group-[.toaster]:bg-card/95",
          title: "group-[.toast]:font-semibold group-[.toast]:text-sm",
          description: "group-[.toast]:text-muted-foreground group-[.toast]:text-xs",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground group-[.toast]:rounded-md group-[.toast]:px-3 group-[.toast]:py-1.5 group-[.toast]:text-xs group-[.toast]:font-semibold hover:group-[.toast]:bg-primary/90",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground group-[.toast]:rounded-md group-[.toast]:px-3 group-[.toast]:py-1.5 group-[.toast]:text-xs",
          closeButton:
            "group-[.toast]:!bg-muted group-[.toast]:!text-foreground group-[.toast]:!border-border/60 hover:group-[.toast]:!bg-accent hover:group-[.toast]:!text-accent-foreground group-[.toast]:!left-auto group-[.toast]:!right-2 group-[.toast]:!top-2 group-[.toast]:opacity-100",
          success:
            "group-[.toaster]:!border-l-4 group-[.toaster]:!border-l-[hsl(var(--success))]",
          error:
            "group-[.toaster]:!border-l-4 group-[.toaster]:!border-l-[hsl(var(--destructive))]",
          warning:
            "group-[.toaster]:!border-l-4 group-[.toaster]:!border-l-[hsl(var(--secondary))]",
          info:
            "group-[.toaster]:!border-l-4 group-[.toaster]:!border-l-[hsl(var(--primary))]",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
