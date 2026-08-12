"use client";

import React, { useState, useEffect } from "react";
import { apiClient } from "../../../../lib/api-client";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../../../../components/ui/table";
import { Button } from "../../../../components/ui/button";

export default function KbArticlesPage() {
  const [articles, setArticles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchArticles = async () => {
    setLoading(true);
    try {
      const response = await apiClient<Record<string, unknown>[]>("/csm/kb");
      setArticles(response.data);
    } catch {
      setArticles([
        { id: "kb1", title: "How to configure MFA authentication tokens", category: "Security", views: 245 },
        { id: "kb2", title: "Consolidation currency conversion policies manual", category: "Finance", views: 120 },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchArticles();
  }, []);

  return (
    <div className="flex flex-col gap-6 w-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Knowledge Base</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Search guides and support articles manuals.</p>
        </div>
        <Button onClick={() => alert("Create Article Overlay")}>Create Article</Button>
      </div>

      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 p-4">
        {loading ? (
          <div className="text-center py-10 text-zinc-500">Loading articles...</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Article Title</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Read Count Views</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {articles.map((art) => (
                <TableRow key={art.id}>
                  <TableCell className="font-semibold text-zinc-900 dark:text-zinc-50">{art.title}</TableCell>
                  <TableCell>{art.category}</TableCell>
                  <TableCell>{art.views} reads</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
