<script lang="ts">
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import * as InputGroup from '$lib/components/ui/input-group/index.js';
	import DropdownMenuContent from '@/components/ui/dropdown-menu/dropdown-menu-content.svelte';
	import DropdownMenuTrigger from '@/components/ui/dropdown-menu/dropdown-menu-trigger.svelte';
	import InputGroupAddon from '@/components/ui/input-group/input-group-addon.svelte';
	import { getLocalTimeZone, today, parseDate } from '@internationalized/date';
	import { Calendar } from '$lib/components/ui/calendar/index.js';
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import Button from '@/components/ui/button/button.svelte';
	import { supabase } from '$lib/supabaseClient.js';
	import { onMount } from 'svelte';
	import { CalendarPlus, ChevronDown, Trash2, SendHorizontal, MessageCircle } from '@lucide/svelte';
	import { cn } from '@/utils';
	import * as NavigationMenu from '$lib/components/ui/navigation-menu/index.js';
	import * as Field from '$lib/components/ui/field/index.js';
	import { Textarea } from '@/components/ui/textarea';
	import * as Collapsible from '@/components/ui/collapsible';
	import { type Database } from '$lib/types/database.types';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import AppSidebar from '$lib/components/app-sidebar.svelte';
	import { Separator } from '$lib/components/ui/separator/index.js';

	type Item = Database['public']['Tables']['Items']['Row'];

	let value = $state(today(getLocalTimeZone()));
	let list = $state<Item[]>([]); // keep the list as reactive state
	let input_title = $state('');
	let input_text = $state('');
	let inputerror = $state('');
	let sortedList = $derived(
		[...list].sort((a, b) => {
			if (a.checked !== b.checked) {
				return Number(a.checked) - Number(b.checked);
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
	);

	supabase.auth.onAuthStateChange((event) => {
		if (event === 'SIGNED_OUT') goto(resolve('/'));
	});

	onMount(() => {
		loadItems();

		const subscription = supabase
			.channel('public:Items')
			.on('postgres_changes', { event: '*', schema: 'public', table: 'Items' }, (payload) => {
				const row = (payload.new ?? payload.old) as Item | null;
				if (!row) return;

				switch (payload.eventType) {
					case 'INSERT':
						list = [...list, row];
						break;
					case 'UPDATE':
						if (row.deleted || !row.dashboard) {
							list = list.filter((item) => item.item_id !== row.item_id);
						} else {
							list = list.map((item) => (item.item_id === row.item_id ? row : item));
						}
						break;
					case 'DELETE':
						list = list.filter((item) => item.item_id !== row.item_id);
						break;

					default:
						break;
				}
			})
			.subscribe();

		return () => supabase.removeChannel(subscription);
	});

	async function loadItems() {
		const { data } = await supabase
			.from('Items')
			.select('*')
			.eq('deleted', false)
			.eq('dashboard', true);
		list = data ?? [];
	}

	async function check(item: Item) {
		await supabase
			.from('Items')
			.update({ checked: item.checked })
			.eq('item_id', item.item_id) // ← Add this: filter by primary key
			.select(); // Optional: returns updated row(s)
	}

	async function updateDate(item: Item) {
		await supabase.from('Items').update({ date: item.date }).eq('item_id', item.item_id).select();
	}

	async function deleteItem(item: Item) {
		await supabase
			.from('Items')
			.update({ deleted: true })
			.eq('item_id', item.item_id) // ← Add this: filter by primary key
			.select(); // Optional: returns updated row(s)
	}

	async function signOut() {
		await supabase.auth.signOut({ scope: 'local' });
	}

	async function itemsToList() {
		if (!input_title.trim() || !input_text.trim()) {
			inputerror = 'Please fill in all fields!';
			return;
		}
		await supabase
			.from('Items')
			.insert({
				title: input_title.trim(),
				text: input_text.trim(),
				date: value.toString().split('T')[0],
				dashboard: true
			})
			.select();
		input_title = '';
		input_text = '';
		value = today(getLocalTimeZone());
	}

	async function dashboardRemove(item: Item) {
		await supabase.from('Items').update({ dashboard: false }).eq('item_id', item.item_id).select();
	}

	function formatDate(dateStr: string) {
		const [year, month, day] = dateStr.split('-');
		return `${month}-${day}-${year}`;
	}
</script>

<NavigationMenu.Root class="flex-0">
	<NavigationMenu.List>
		<NavigationMenu.Item>
			<NavigationMenu.Link class="text-2xl hover:cursor-pointer" href="/"
				>Community</NavigationMenu.Link
			>
		</NavigationMenu.Item>
	</NavigationMenu.List>
</NavigationMenu.Root>
<Sidebar.Provider>
	<main class="w-full">
		<div class="mr-5 flex place-items-center justify-end">
			<Sidebar.Trigger class="size-auto"
				><MessageCircle color="black" class="size-7" /></Sidebar.Trigger
			>
			<Separator orientation="vertical" class="mx-5 px-0.5 py-5" />
			<Button onclick={() => signOut()}>Sign Out</Button>
		</div>
		<div class="mx-auto grid w-1/2 grid-cols-1">
			<h6 class="text-7xl">Dashboard</h6>
			<Field.Set class="rounded-lg border-2 border-black p-10">
				<Field.Legend class="text-4xl!">Share your idea!</Field.Legend>
				<Field.Group>
					<Field.Field>
						<Field.Label for="input-title" class="text-3xl">Title</Field.Label>
						<InputGroup.Root class="h-15">
							<InputGroup.Input
								id="input-title"
								class="text-2xl!"
								contenteditable="true"
								bind:value={input_title}
								maxlength={45}
							/>
							<InputGroupAddon align="inline-end">
								<DropdownMenu.Root>
									<DropdownMenuTrigger>
										<CalendarPlus color="black" />
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
					</Field.Field>
					<Field.Field>
						<Field.Label for="input-text" class="text-3xl">Description</Field.Label>
						<Textarea class="h-100 text-xl!" id="input-text" bind:value={input_text} />
					</Field.Field>
				</Field.Group>
				<p class="text-center text-xl text-red-500">{inputerror}</p>
				<Button class="flex h-10 w-30 place-self-center text-3xl" onclick={itemsToList}
					>Submit</Button
				>
			</Field.Set>
			<h6 class="text-green-500">
				Deleted items can always be recovered. Feel free to delete them if need be.
			</h6>
			{#each sortedList as item (item.item_id)}
				<div class="my-5 flex justify-between">
					<div class="flex gap-2">
						{#if !item.checked}
							<SendHorizontal
								class="black mt-0.5 shrink-0 scale-x-[-1]"
								onclick={() => dashboardRemove(item)}
							/>
						{/if}
						<Checkbox
							class="size-7 border-2 border-black"
							id={item.item_id}
							onCheckedChange={(val) => {
								item.checked = val;
								check(item);
							}}
							bind:checked={item.checked}
						/>
						{#if !item.checked}
							<Collapsible.Root>
								<Collapsible.Trigger class="cursor-pointer">
									<p class={cn(item.checked ? 'line-through' : '', 'text-2xl wrap-break-word')}>
										{item.title}
									</p></Collapsible.Trigger
								>
								<Collapsible.Content>
									<p class="text-xl wrap-break-word">{item.text}</p>
								</Collapsible.Content>
							</Collapsible.Root>
						{:else}
							<p class={cn(item.checked ? 'line-through' : '', 'text-2xl wrap-break-word')}>
								{item.title}
							</p>
						{/if}
					</div>
					<div class="ml-5 flex shrink-0 gap-5">
						<DropdownMenu.Root>
							<DropdownMenuTrigger class="flex gap-1">
								{formatDate(item.date)}
								<ChevronDown color="black" />
							</DropdownMenuTrigger>
							<DropdownMenuContent>
								<Calendar
									type="single"
									value={parseDate(item.date)}
									onValueChange={(newVal) => {
										if (newVal) item.date = newVal.toString();
										updateDate(item);
									}}
									class="rounded-md border shadow-sm"
									captionLayout="dropdown"
								/>
							</DropdownMenuContent>
						</DropdownMenu.Root>
						<Trash2 color="black" size="20" onclick={() => deleteItem(item)} />
					</div>
				</div>
			{/each}
		</div>
	</main>
	<AppSidebar />
</Sidebar.Provider>
