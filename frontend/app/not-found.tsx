import Link from "next/link";

export default function NotFound() {
  return (
    <div className="pt-16">
      <h1 className="text-3xl font-bold tracking-tight">We can&rsquo;t find that page</h1>
      <p className="mt-3 text-lg text-tgray">The link may be old or mistyped. Start from the home page to plan your car&rsquo;s next move.</p>
      <Link href="/" className="btn-primary mt-8">
        Go to the home page
      </Link>
    </div>
  );
}
