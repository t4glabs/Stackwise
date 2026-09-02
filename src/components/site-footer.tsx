import { Container } from "@/components/ui/container";

export function SiteFooter() {
  return (
    <footer className="border-t border-grey-200 py-8 text-xs text-grey-600">
      <Container className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <span>WeLive Foundation Learning</span>
        <span>
          Content authored in{" "}
          <a
            className="text-accent hover:underline"
            href="https://books.humansofwelive.org"
            target="_blank"
            rel="noreferrer"
          >
            the WeLive wiki
          </a>
        </span>
      </Container>
    </footer>
  );
}
