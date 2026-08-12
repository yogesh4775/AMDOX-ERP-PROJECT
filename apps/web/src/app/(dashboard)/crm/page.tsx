"use client";

import React, { useState, useEffect } from "react";
import { apiClient } from "../../../lib/api-client";
import { Card, CardHeader, CardTitle, CardContent } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";

const COLUMNS = ["QUALIFICATION", "PROPOSAL", "NEGOTIATION", "WON", "LOST"];

export default function OpportunitiesPage() {
  const [opportunities, setOpportunities] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchOpportunities = async () => {
    setLoading(true);
    try {
      const response = await apiClient<Record<string, unknown>[]>("/crm/opportunities");
      setOpportunities(response.data);
    } catch {
      // Mock data fallback
      setOpportunities([
        { id: "o1", title: "Enterprise ERP roll out", value: 150000, company: "Acme Corp", stage: "QUALIFICATION" },
        { id: "o2", title: "CRM custom features", value: 45000, company: "Globex Inc", stage: "PROPOSAL" },
        { id: "o3", title: "Consolidation module deployment", value: 95000, company: "Peanuts Ltd", stage: "NEGOTIATION" },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOpportunities();
  }, []);

  const onDragEnd = async (result: any) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;

    if (destination.droppableId === source.droppableId) return;

    const updatedStage = destination.droppableId;
    const updated = opportunities.map((opp) => {
      if (opp.id === draggableId) {
        return { ...opp, stage: updatedStage };
      }
      return opp;
    });
    setOpportunities(updated);

    try {
      await apiClient(`/crm/opportunities/${draggableId}`, {
        method: "PATCH",
        body: JSON.stringify({ stage: updatedStage }),
      });
    } catch (err) {
      console.error("Failed to persist stage drag update:", err);
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Opportunities Board</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Manage customer acquisition pipelines and opportunities.</p>
      </div>

      {loading ? (
        <div className="text-zinc-500 text-center py-10">Loading pipeline...</div>
      ) : (
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="grid gap-4 md:grid-cols-5 overflow-x-auto pb-4">
            {COLUMNS.map((col) => {
              const colOpps = opportunities.filter((o) => o.stage === col);
              return (
                <div key={col} className="flex flex-col gap-3 min-w-[200px] bg-zinc-100/55 dark:bg-zinc-900/30 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800">
                  <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-2">
                    <span className="text-xs font-bold text-zinc-500 tracking-wider uppercase">{col}</span>
                    <span className="text-xs bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded-full px-2 py-0.5 font-bold">
                      {colOpps.length}
                    </span>
                  </div>

                  <Droppable droppableId={col}>
                    {(provided) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className="flex-1 flex flex-col gap-3 min-h-[400px]"
                      >
                        {colOpps.map((opp, index) => (
                          <Draggable key={opp.id} draggableId={opp.id} index={index}>
                            {(provided) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                              >
                                <Card className="hover:border-emerald-500/40 cursor-grab active:cursor-grabbing p-4">
                                  <div className="flex flex-col gap-2">
                                    <span className="text-xs font-semibold text-zinc-500">{opp.company}</span>
                                    <span className="text-sm font-bold leading-tight">{opp.title}</span>
                                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-zinc-100 dark:border-zinc-800/80">
                                      <span className="text-xs text-zinc-400">Est. Value</span>
                                      <span className="text-sm font-bold text-emerald-500">${opp.value.toLocaleString()}</span>
                                    </div>
                                  </div>
                                </Card>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </div>
              );
            })}
          </div>
        </DragDropContext>
      )}
    </div>
  );
}
