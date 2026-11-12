import Link from "next/link";

export default function Page() {
  return (
    <div style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1>Sign up successful</h1>
      <p>
        <Link href="/login">Go to login</Link>
      </p>
    </div>
  );
}
