'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Download } from 'lucide-react'

interface TopPerformer {
  workerId: string
  workerName: string
  value: number
}

interface AdminDashboardData {
  growth: { newUsers: number; newWorkers: number; newReviews: number }
  engagement: { views: number; contacts: number; bookmarks: number }
  revenue: { totalRevenue: number; totalTransactions: number }
  disputes: { total: number; resolved: number; resolutionRate: number }
  topPerformers: TopPerformer[]
}

interface AdminDashboardProps {
  /** Pre-fetched data for SSR; dashboard fetches fresh data client-side when filters change. */
  initialData?: AdminDashboardData
}

export function AdminAnalyticsDashboard({ initialData }: AdminDashboardProps) {
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [data, setData] = useState(initialData)
  const [loading, setLoading] = useState(false)

  const fetchData = async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (startDate) params.append('startDate', startDate)
    if (endDate) params.append('endDate', endDate)

    const res = await fetch(`/api/analytics/admin/dashboard?${params}`)
    const json = await res.json()
    setData(json.data)
    setLoading(false)
  }

  const exportCsv = () => {
    const params = new URLSearchParams()
    if (startDate) params.append('startDate', startDate)
    if (endDate) params.append('endDate', endDate)
    window.location.href = `/api/analytics/admin/export?${params}`
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-4 items-end">
        <div className="flex-1">
          <label className="text-sm font-medium">Start Date</label>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div className="flex-1">
          <label className="text-sm font-medium">End Date</label>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
        <Button onClick={fetchData} disabled={loading}>
          Apply Filters
        </Button>
        <Button variant="outline" onClick={exportCsv}>
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {data && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Growth</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div>
                  <p className="text-xs text-muted-foreground">New Users</p>
                  <p className="text-2xl font-bold">{data.growth.newUsers}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">New Workers</p>
                  <p className="text-2xl font-bold">{data.growth.newWorkers}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">New Reviews</p>
                  <p className="text-2xl font-bold">{data.growth.newReviews}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Engagement</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div>
                  <p className="text-xs text-muted-foreground">Profile Views</p>
                  <p className="text-2xl font-bold">{data.engagement.views}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Contact Requests</p>
                  <p className="text-2xl font-bold">{data.engagement.contacts}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Bookmarks</p>
                  <p className="text-2xl font-bold">{data.engagement.bookmarks}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div>
                  <p className="text-xs text-muted-foreground">Total Revenue (XLM)</p>
                  <p className="text-2xl font-bold">{data.revenue.totalRevenue.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Transactions</p>
                  <p className="text-2xl font-bold">{data.revenue.totalTransactions}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Disputes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div>
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="text-2xl font-bold">{data.disputes.total}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Resolved</p>
                  <p className="text-2xl font-bold">{data.disputes.resolved}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Resolution Rate</p>
                  <p className="text-2xl font-bold">{data.disputes.resolutionRate}%</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Top Performers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {data.topPerformers.slice(0, 5).map((performer: TopPerformer, idx: number) => (
                  <div key={performer.workerId} className="flex justify-between">
                    <span className="text-sm">
                      {idx + 1}. {performer.workerName}
                    </span>
                    <span className="text-sm font-medium">{performer.value} XLM</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
