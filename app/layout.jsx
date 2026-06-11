export const metadata = {
  title: "Proof-of-Value — show the client their numbers",
  description:
    "Sales-enablement calculator for staffing agencies: live cost gap, AI placement plan, ready-to-send follow-up.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#F6F7F9" }}>{children}</body>
    </html>
  );
}
