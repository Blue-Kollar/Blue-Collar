import type { Meta, StoryObj } from '@storybook/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

const meta: Meta<typeof Card> = {
  title: 'Design System/Card',
  component: Card,
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<typeof Card>;

export const Default: Story = {
  render: (args) => (
    <Card {...args} className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Electrician</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Licensed electrician available for residential repairs and installations.
        </p>
      </CardContent>
      <CardFooter>
        <Button>View profile</Button>
      </CardFooter>
    </Card>
  ),
};
