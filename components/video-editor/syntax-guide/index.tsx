"use client"

import { Button } from "@components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@components/ui/tabs"
import { X, Code, Type, Wand2, HelpCircle } from "lucide-react"
import { BasicsTab, AdvancedTab, EffectsTab } from "./tabs"

interface SyntaxGuideProps {
  onClose: () => void
}

export function SyntaxGuide({ onClose }: SyntaxGuideProps) {
  return (
    <div className="w-80 bg-white dark:bg-neutral-950 border-l border-gray-200 dark:border-neutral-800 flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-neutral-800 shrink-0">
        <div className="flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-gray-600 dark:text-neutral-400" />
          <h2 className="text-sm font-medium text-gray-900 dark:text-neutral-100">Syntax Guide</h2>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-8 w-8 text-gray-500 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-neutral-800"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <Tabs defaultValue="basics" className="flex-1 flex flex-col min-h-0">
        <TabsList className="mx-3 mt-3 bg-gray-100 dark:bg-neutral-900 p-1 shrink-0 border border-gray-200 dark:border-neutral-800">
          <TabsTrigger value="basics" className="text-xs gap-1.5 data-[state=active]:bg-white data-[state=active]:dark:bg-neutral-800 data-[state=active]:text-gray-900 data-[state=active]:dark:text-white">
            <Type className="w-3 h-3" /> Basics
          </TabsTrigger>
          <TabsTrigger value="advanced" className="text-xs gap-1.5 data-[state=active]:bg-white data-[state=active]:dark:bg-neutral-800 data-[state=active]:text-gray-900 data-[state=active]:dark:text-white">
            <Code className="w-3 h-3" /> Advanced
          </TabsTrigger>
          <TabsTrigger value="effects" className="text-xs gap-1.5 data-[state=active]:bg-white data-[state=active]:dark:bg-neutral-800 data-[state=active]:text-gray-900 data-[state=active]:dark:text-white">
            <Wand2 className="w-3 h-3" /> Effects
          </TabsTrigger>
        </TabsList>

        <div className="flex-1 min-h-0 overflow-y-auto bg-white dark:bg-neutral-950">
          <TabsContent value="basics" className="p-4 space-y-5 mt-0 data-[state=inactive]:hidden">
            <BasicsTab />
          </TabsContent>

          <TabsContent value="advanced" className="p-4 space-y-5 mt-0 data-[state=inactive]:hidden">
            <AdvancedTab />
          </TabsContent>

          <TabsContent value="effects" className="p-4 space-y-5 mt-0 data-[state=inactive]:hidden">
            <EffectsTab />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
