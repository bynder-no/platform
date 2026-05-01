import Link from "next/link";

export default function ListingNotFound() {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col px-4 py-16">
      <h1 className="text-xl font-semibold text-zinc-900">
        Listing not found
      </h1>
      <p className="mt-3 text-sm text-zinc-600">
        This listing does not exist or you do not have access to it.
      </p>
      <p className="mt-8">
        <Link
          href="/dashboard"
          className="text-sm font-medium text-zinc-900 underline-offset-2 hover:underline"
        >
          Back to dashboard
        </Link>
      </p>
    </div>
  );
}
