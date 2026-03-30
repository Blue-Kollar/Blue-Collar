import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "About",
  description: "Learn how BlueCollar connects skilled workers with communities using the Stellar blockchain.",
};

const HOW_IT_WORKS = [
  {
    step: "01",
    title: "Browse & Discover",
    description:
      "Search by skill or category to find verified tradespeople in your area. Every listing is community-curated.",
  },
  {
    step: "02",
    title: "Connect On-Chain",
    description:
      "Worker profiles are anchored on the Stellar blockchain via Soroban smart contracts — transparent and tamper-proof.",
  },
  {
    step: "03",
    title: "Pay Securely",
    description:
      "Send tips and payments directly to workers using Stellar tokens. No middlemen, no hidden fees.",
  },
];

const TECH = [
  {
    name: "Stellar",
    description:
      "A fast, low-cost blockchain network designed for real-world financial applications. BlueCollar uses Stellar for on-chain payments and worker registration.",
  },
  {
    name: "Soroban",
    description:
      "Stellar's smart contract platform. Our Registry contract stores worker listings immutably on-chain; the Market contract handles trustless token transfers.",
  },
  {
    name: "Freighter Wallet",
    description:
      "A browser extension wallet for the Stellar network. Connect your Freighter wallet to tip workers and interact with BlueCollar contracts.",
  },
];

export default function AboutPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-white dark:bg-gray-950">
        {/* Hero */}
        <section className="bg-blue-600 px-4 py-20 text-center text-white">
          <h1 className="text-4xl font-bold sm:text-5xl">About BlueCollar</h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-blue-100">
            A decentralised protocol connecting skilled workers with the communities that need them —
            powered by the Stellar blockchain.
          </p>
        </section>

        {/* Mission */}
        <section className="mx-auto max-w-3xl px-4 py-16 text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl">Our Mission</h2>
          <p className="mt-4 text-gray-600 dark:text-gray-400 leading-relaxed">
            Millions of skilled tradespeople — plumbers, electricians, carpenters, welders — lack a
            platform to get noticed. Meanwhile, people struggle to find reliable, vetted workers they
            can trust. BlueCollar bridges that gap with a trustless, community-driven directory where
            listings are verifiable on-chain and payments flow directly between users and workers.
          </p>
        </section>

        {/* How It Works */}
        <section className="bg-gray-50 dark:bg-gray-900 px-4 py-16">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-center text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl">
              How It Works
            </h2>
            <div className="mt-12 grid gap-8 sm:grid-cols-3">
              {HOW_IT_WORKS.map(({ step, title, description }) => (
                <div key={step} className="rounded-2xl border bg-white p-6 shadow-sm dark:bg-gray-800 dark:border-gray-700">
                  <span className="text-4xl font-black text-blue-100 dark:text-blue-900">{step}</span>
                  <h3 className="mt-3 text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Technology */}
        <section className="mx-auto max-w-5xl px-4 py-16">
          <h2 className="text-center text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl">
            The Technology
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-gray-500 dark:text-gray-400">
            BlueCollar is built on open, decentralised infrastructure — no single point of failure,
            no gatekeepers.
          </p>
          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            {TECH.map(({ name, description }) => (
              <div key={name} className="rounded-2xl border p-6 dark:border-gray-700">
                <h3 className="font-semibold text-blue-600">{name}</h3>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Community */}
        <section className="bg-gray-50 dark:bg-gray-900 px-4 py-16">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl">
              Community-Driven
            </h2>
            <p className="mt-4 text-gray-600 dark:text-gray-400 leading-relaxed">
              BlueCollar is governed by its community. Curators — trusted members who create and
              manage worker listings — are the backbone of the platform. Anyone can apply to become a
              curator and help grow the network of verified tradespeople in their area.
            </p>
          </div>
        </section>

        {/* CTA */}
        <section className="px-4 py-20 text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl">
            Ready to contribute?
          </h2>
          <p className="mt-3 text-gray-500 dark:text-gray-400">
            Join as a curator and help skilled workers in your community get discovered.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/auth/register"
              className="rounded-lg bg-blue-600 px-6 py-3 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
            >
              Join as a Curator
            </Link>
            <Link
              href="/workers"
              className="rounded-lg border px-6 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Browse Workers
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
