import Link from "next/link";

export default function Page() {
  return (
    <div style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1>Auth error</h1>
      <p>
        <Link href="/login">Back to login</Link>
      </p>
    </div>
  );
}
