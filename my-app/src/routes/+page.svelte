<script lang="ts">
    import * as DropdownMenu from "$lib/components/ui/dropdown-menu/index.js";
    import * as InputGroup from "$lib/components/ui/input-group/index.js";
    import DropdownMenuContent from "@/components/ui/dropdown-menu/dropdown-menu-content.svelte";
    import DropdownMenuTrigger from "@/components/ui/dropdown-menu/dropdown-menu-trigger.svelte";
    import InputGroupAddon from "@/components/ui/input-group/input-group-addon.svelte";
    import { CalendarDate, getLocalTimeZone, today } from "@internationalized/date";
    import { Calendar } from "$lib/components/ui/calendar/index.js";
    import { Checkbox } from "$lib/components/ui/checkbox/index.js";
    import { Label } from "$lib/components/ui/label/index.js";
    import * as Dialog from "$lib/components/ui/dialog/index.js";
    import DialogTrigger from "@/components/ui/dialog/dialog-trigger.svelte";
    import DialogContent from "@/components/ui/dialog/dialog-content.svelte";
    import * as Field from "$lib/components/ui/field/index.js";
    import Button from "@/components/ui/button/button.svelte";
    import Input from "@/components/ui/input/input.svelte";
    import { signIn } from "@auth/sveltekit/client";
    
    let value = $state(today(getLocalTimeZone()))
    let list = $state<Item[]>([])
    
    interface Item {
        id: string;
        text: string;
        checked: boolean;
        date: CalendarDate;
    }
    
    $effect(() => {
        list.sort((a, b) => {
            if (a.checked !== b.checked) {
                return Number(a.checked) - Number(b.checked)
            }
            
            if (a.checked) {
                if (a.date > b.date) return -1;
                if (a.date < b.date) return 1;
            } else {
                if (a.date < b.date) return -1;
                if (a.date > b.date) return 1;
            }
            
            return 0;
        })
    })
    
    let input = $state('')
    
    function check(item: Item) {
        item.checked = !item.checked
        list = list;
    }
    
    function itemsToList(e: KeyboardEvent) {
        if (e.key !== 'Enter') return
        
        e.preventDefault()
        if (!input.trim()) return
        
        list.unshift({id: crypto.randomUUID(), text: input.trim(), checked: false, date: value})
        input=''
        value=today(getLocalTimeZone())
    }
</script>
<div class="flex justify-end mt-5 mr-5">
    <Dialog.Root>
        <DialogTrigger type="button">
            Sign Up!
        </DialogTrigger>
        <DialogContent>
            <form>
                <Field.Group>
                    <Field.Field>
                        <Field.Label>
                            Username
                        </Field.Label>
                        <Input />
                    </Field.Field>
                    <Field.Field>
                        <Field.Label>
                            Password
                        </Field.Label>
                        <Input />
                    </Field.Field>
                    <Button type="submit">
                        Sign In
                    </Button>
                </Field.Group>
            </form>
            <Button class="bg-red-400" onclick={() => signIn()}>Google</Button>
        </DialogContent>
    </Dialog.Root>
</div>
<div class="grid grid-cols-1 w-1/2 mx-auto">
    <InputGroup.Root class="mt-10">
        <InputGroup.Input onkeypress={itemsToList} contenteditable="true" bind:value={input} />
        <InputGroupAddon align="inline-end">
            <DropdownMenu.Root>
                <DropdownMenuTrigger>
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="currentColor" d="M19 19H5V8h14m-3-7v2H8V1H6v2H5c-1.11 0-2 .89-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-1V1m-1 11h-5v5h5z"/></svg>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                    <Calendar
                    type="single"
                    bind:value
                    class="rounded-md border shadow-sm"
                    captionLayout="dropdown"
                    />
                </DropdownMenuContent>
            </DropdownMenu.Root>
        </InputGroupAddon>
    </InputGroup.Root>
    {#each list as item (item.id)}
    <div class="flex justify-between mt-5">
        <div class="flex gap-2">
            <Checkbox id={item.id} onclick={() => check(item)} />
                <Label for={item.id} class={{ 'line-through': item.checked, '': !item.checked }}>{item.text}</Label>
            </div>
            <DropdownMenu.Root>
                <DropdownMenuTrigger class="place-self-end">{item.date}</DropdownMenuTrigger>
                <DropdownMenuContent>
                    <Calendar
                    type="single"
                    bind:value={item.date}
                    class="rounded-md border shadow-sm"
                    captionLayout="dropdown"
                    />
                </DropdownMenuContent>
            </DropdownMenu.Root>
        </div>
        {/each}
    </div>