import { Page } from "@/components/ui/Page";
import { ClassBoard } from "@/components/classes/ClassBoard";

export default function ClassesPage() {
  return (
    <Page
      title="Classes"
      description="Instances of Master Class Delivery. Scheduling a class generates its standard setup checklist as real, trackable tasks."
    >
      <ClassBoard />
    </Page>
  );
}
